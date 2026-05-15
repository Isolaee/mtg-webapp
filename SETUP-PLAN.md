# Deployment Setup Plan

**Stack:** AWS CDK (TypeScript) · EC2 + CloudFront/S3 · Cloudflare (domain) · GitHub Actions (CI/CD)

---

## Overview

```
GitHub Actions
  ├── cdk deploy          (infrastructure, idempotent)
  ├── build React → S3   → CloudFront invalidation
  └── build Rust binary → SSM SendCommand → EC2
                               ├── nginx proxies /api → Axum :8080
                               │                            └── SQLite on EBS
                               └── nginx proxies /    → CloudFront origin (or local static fallback)

CloudFront sits in front of everything:
  / (and /*) → S3 static bucket (React build)
  /api/*     → EC2 via ALB origin (Rust backend)

Cloudflare:
  CNAME → CloudFront distribution domain
  SSL terminated at Cloudflare edge (Full strict)
```

---

## 0. Prerequisites

```bash
npm install -g aws-cdk
aws configure   # set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, region (e.g. eu-west-1)
cdk bootstrap   # one-time per account/region
```

---

## 1. CDK Project Setup

Create the CDK app in the repo root:

```bash
mkdir cdk && cd cdk
cdk init app --language typescript
npm install aws-cdk-lib constructs
```

File layout after setup:
```
cdk/
  bin/tcg-infra.ts       ← entry point, instantiates TcgStack
  lib/tcg-stack.ts       ← all infrastructure defined here
  cdk.json
  tsconfig.json
```

---

## 2. CDK Stack

**`cdk/bin/tcg-infra.ts`**

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TcgStack } from '../lib/tcg-stack';

const app = new cdk.App();
new TcgStack(app, 'TcgStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
```

**`cdk/lib/tcg-stack.ts`**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class TcgStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── JWT secret ────────────────────────────────────────────────────────
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'tcg/jwt-secret',
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    // ── VPC (default — no NAT gateway cost) ───────────────────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: true });

    // ── Security group ────────────────────────────────────────────────────
    const sg = new ec2.SecurityGroup(this, 'BackendSg', { vpc });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    // No port 22 — deploy via SSM, not SSH

    // ── EC2 role (SSM + Secrets Manager + S3 backup) ──────────────────────
    const role = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    jwtSecret.grantRead(role);

    // ── S3: database backups ──────────────────────────────────────────────
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `tcg-db-backups-${this.account}`,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    backupBucket.grantReadWrite(role);

    // ── S3: frontend static hosting ───────────────────────────────────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `tcg-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ── EC2 instance ──────────────────────────────────────────────────────
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'apt-get update -y',
      'apt-get install -y nginx awscli',
      // SSM agent (pre-installed on Amazon Linux; needed for Ubuntu)
      'snap install amazon-ssm-agent --classic',
      'systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service',
      'systemctl start  snap.amazon-ssm-agent.amazon-ssm-agent.service',
      // App directories
      'mkdir -p /var/lib/tcg/backups',
      'chown ubuntu:ubuntu /var/lib/tcg /var/lib/tcg/backups',
      // Pull JWT secret at boot and write systemd override
      `JWT=$(aws secretsmanager get-secret-value --secret-id tcg/jwt-secret --query SecretString --output text --region ${this.region})`,
      'mkdir -p /etc/systemd/system/tcg-backend.service.d',
      'echo -e "[Service]\\nEnvironment=JWT_SECRET=$JWT" > /etc/systemd/system/tcg-backend.service.d/secret.conf',
    );

    const instance = new ec2.Instance(this, 'Backend', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.genericLinux({ 'eu-west-1': 'ami-0c1c30571d2dae5be' }), // Ubuntu 22.04 — update AMI per region
      securityGroup: sg,
      role,
      userData,
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(20),  // 20 GB for OS + SQLite
      }],
    });

    // Elastic IP — stable address for Cloudflare CNAME target
    const eip = new ec2.CfnEIP(this, 'BackendEip');
    new ec2.CfnEIPAssociation(this, 'BackendEipAssoc', {
      instanceId: instance.instanceId,
      allocationId: eip.attrAllocationId,
    });

    // ── CloudFront ────────────────────────────────────────────────────────
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC');
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, { originAccessControl: oac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(eip.ref, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' }, // React Router
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });
    frontendBucket.grantRead(new iam.ServicePrincipal('cloudfront.amazonaws.com'));

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ElasticIp',          { value: eip.ref });
    new cdk.CfnOutput(this, 'CloudFrontDomain',   { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'BackupBucketName',   { value: backupBucket.bucketName });
    new cdk.CfnOutput(this, 'InstanceId',         { value: instance.instanceId });
    new cdk.CfnOutput(this, 'BackupBucketArn',    { value: backupBucket.bucketArn });
  }
}
```

Deploy infrastructure:

```bash
cd cdk
npm run build
cdk diff    # preview changes
cdk deploy  # creates all resources; outputs ElasticIp, CloudFrontDomain, etc.
```

---

## 3. Nginx Configuration (on EC2)

SSH in once manually (via EC2 Instance Connect in the AWS console, or `aws ssm start-session`), then create `/etc/nginx/sites-available/tcg`:

```nginx
server {
    listen 80 default_server;

    # API proxy to Axum
    location /api/ {
        proxy_pass         http://127.0.0.1:8080/api/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    # Health check (CloudFront pings this)
    location /health {
        proxy_pass http://127.0.0.1:8080/health;
    }

    # Deny everything else — frontend is served by CloudFront/S3
    location / {
        return 404;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/tcg /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx
```

---

## 4. Systemd Service (on EC2)

Create `/etc/systemd/system/tcg-backend.service`:

```ini
[Unit]
Description=TCG Builder Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/lib/tcg
ExecStart=/var/lib/tcg/tcg-backend
Restart=on-failure
RestartSec=5

Environment=DATABASE_URL=sqlite:/var/lib/tcg/mtg_card_db.db
Environment=RUST_LOG=tcg_backend=info,tower_http=info
# JWT_SECRET injected at boot via /etc/systemd/system/tcg-backend.service.d/secret.conf

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tcg-backend
```

The CDK user-data script pulls `JWT_SECRET` from Secrets Manager and writes the `service.d/secret.conf` drop-in automatically on every boot.

---

## 5. Cloudflare Domain Setup

1. Sign up at [cloudflare.com](https://cloudflare.com) (free plan)
2. Add your domain → update nameservers at your registrar
3. **DNS → Add record:**
   - Type: `CNAME`
   - Name: `@` (root) — use Cloudflare's CNAME flattening
   - Target: the `CloudFrontDomain` CDK output (e.g. `d1abc123.cloudfront.net`)
   - Proxy status: **Proxied** (orange cloud)
4. Repeat for `www` pointing to the same CloudFront domain

### SSL

In **SSL/TLS** → set mode to **Full** (not strict — CloudFront's origin to EC2 is HTTP on port 80 within AWS).

---

## 6. GitHub Repository Secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user key with EC2/S3/CloudFront/CDK permissions |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `AWS_REGION` | e.g. `eu-west-1` |
| `EC2_INSTANCE_ID` | From CDK output `InstanceId` |
| `FRONTEND_BUCKET` | From CDK output `FrontendBucketName` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID (from AWS console or CDK output) |
| `REACT_APP_API_URL` | `https://yourdomain.com/api` |
| `BACKUP_BUCKET` | From CDK output `BackupBucketName` — used by the Teardown workflow |

No SSH key needed — deployment uses AWS SSM.

### IAM deploy user policy (least privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:PutObject","s3:DeleteObject","s3:ListBucket"], "Resource": ["arn:aws:s3:::tcg-frontend-*","arn:aws:s3:::tcg-frontend-*/*"] },
    { "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["ssm:SendCommand","ssm:GetCommandInvocation"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["cloudformation:*","ec2:*","iam:*","secretsmanager:*","s3:*"], "Resource": "*" }
  ]
}
```

Split into two IAM users in practice: one narrow deploy user (first three statements) and one CDK bootstrap user for `cdk deploy`.

---

## 7. GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ${{ secrets.AWS_REGION }}

      # ── CDK (infrastructure, idempotent) ─────────────────────────────────
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: cdk/package-lock.json

      - name: Deploy CDK stack
        working-directory: cdk
        run: |
          npm ci
          npm run build
          npx cdk deploy --require-approval never

      # ── Frontend ──────────────────────────────────────────────────────────
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Build React app
        working-directory: frontend
        env:
          REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL }}
        run: |
          npm ci
          npm run build

      - name: Upload to S3
        run: aws s3 sync frontend/build/ s3://${{ secrets.FRONTEND_BUCKET }}/ --delete

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      # ── Backend ───────────────────────────────────────────────────────────
      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: backend-rust

      - name: Build Rust backend
        working-directory: backend-rust
        run: cargo build --release

      - name: Deploy binary via SSM
        env:
          INSTANCE_ID: ${{ secrets.EC2_INSTANCE_ID }}
        run: |
          # Upload binary to a temp S3 path then pull it down on the instance
          aws s3 cp backend-rust/target/release/tcg-backend \
            s3://${{ secrets.FRONTEND_BUCKET }}/deploy/tcg-backend

          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "$INSTANCE_ID" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "sudo systemctl stop tcg-backend || true",
              "aws s3 cp s3://${{ secrets.FRONTEND_BUCKET }}/deploy/tcg-backend /var/lib/tcg/tcg-backend",
              "chmod +x /var/lib/tcg/tcg-backend",
              "sudo systemctl start tcg-backend",
              "sleep 2",
              "curl -sf http://localhost:8080/health || (sudo journalctl -u tcg-backend -n 20 && exit 1)"
            ]' \
            --query "Command.CommandId" --output text)

          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "$INSTANCE_ID"

          aws ssm get-command-invocation \
            --command-id "$COMMAND_ID" \
            --instance-id "$INSTANCE_ID" \
            --query "StandardOutputContent" --output text
```

---

## 8. Initial Data Setup (one-time)

The SQLite database must be copied to the server. Use SSM instead of SCP:

```bash
# Upload DB to S3
aws s3 cp database/mtg_card_db.db s3://tcg-db-backups-<ACCOUNT_ID>/initial/mtg_card_db.db

# Pull it down on the instance via SSM
aws ssm send-command \
  --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "aws s3 cp s3://tcg-db-backups-<ACCOUNT_ID>/initial/mtg_card_db.db /var/lib/tcg/mtg_card_db.db",
    "chown ubuntu:ubuntu /var/lib/tcg/mtg_card_db.db"
  ]'
```

### Seed Riftbound cards (if not already in the DB)

```bash
aws ssm send-command \
  --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /var/lib/tcg && DATABASE_URL=sqlite:./mtg_card_db.db ./seed_riftbound"]'
```

### Populate card hashes (required for card scanning, ~1–2 hours)

```bash
aws ssm send-command \
  --instance-ids <INSTANCE_ID> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["DATABASE_URL=sqlite:/var/lib/tcg/mtg_card_db.db /var/lib/tcg/hash_cards"]'
```

To also deploy utility binaries via CI, add a step in the workflow parallel to the main binary upload.

---

## 9. Android Build

Once the server is live at `yourdomain.com`:

```bash
# In frontend/
echo "REACT_APP_API_URL=https://yourdomain.com/api" > .env.production

npm run build
npx cap sync android
npx cap open android    # Build → Build APK(s) in Android Studio
```

The CORS config in `backend-rust/src/main.rs` already allows `capacitor://localhost`.

Before building the APK, complete the AdMob placeholder replacements in section 12.

---

## 10. Database Backups

Add a daily backup cron on the instance (set up via SSM):

```bash
crontab -e   # as ubuntu
# Add:
0 3 * * * aws s3 cp /var/lib/tcg/mtg_card_db.db s3://tcg-db-backups-$(aws sts get-caller-identity --query Account --output text)/daily/mtg_card_db_$(date +\%Y\%m\%d).db
```

The CDK bucket lifecycle rule (`expiration: 30 days`) auto-deletes backups older than 30 days.

---

## 11. Monetization Setup

The app has four monetization components. Each has placeholder values in the code that must be replaced before going live.

### Summary of placeholders

| File | Placeholder | Replace with |
|------|-------------|--------------|
| `frontend/public/index.html` | `ca-pub-XXXXXXXXXXXXXXXX` | AdSense Publisher ID |
| `frontend/src/components/AdSlot.tsx` | `ca-pub-XXXXXXXXXXXXXXXX` | AdSense Publisher ID |
| `frontend/src/App.tsx` | `XXXXXXXXXX` (SLOT_ID_LEADERBOARD) | AdSense leaderboard ad unit slot ID |
| `frontend/src/components/Footer.tsx` | `XXXXXXXXXX` (SLOT_ID_FOOTER) | AdSense footer ad unit slot ID |
| `frontend/src/components/Footer.tsx` | `ko-fi.com/YOURUSERNAME` | Your Ko-Fi profile URL |
| `frontend/src/components/Nav.tsx` | `ko-fi.com/YOURUSERNAME` | Your Ko-Fi profile URL |
| `frontend/android/app/src/main/AndroidManifest.xml` | `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX` | AdMob App ID |
| `frontend/src/components/AndroidBanner.tsx` | `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX` | AdMob Banner Ad Unit ID |

---

### Ko-Fi (do this first — takes 5 minutes)

1. Sign up at [ko-fi.com](https://ko-fi.com) and set up your page
2. Replace `YOURUSERNAME` in two files:
   - `frontend/src/components/Nav.tsx`
   - `frontend/src/components/Footer.tsx`
3. Redeploy — Ko-Fi link appears immediately in the Nav and Footer on all platforms

---

### Google AdSense (web ads — apply after site is live)

AdSense requires site review, which can take days to weeks. Apply once the site has real content and traffic.

1. Sign up at [adsense.google.com](https://adsense.google.com)
2. Add your site URL and follow the verification steps
3. Once approved, go to **Ads → By ad unit → Create ad unit**:
   - Create two **Display** responsive units: one for the leaderboard (below nav), one for the footer
   - Note each unit's **Slot ID** (format: 10-digit number)
4. Find your **Publisher ID** in AdSense → Account → Account information (format: `ca-pub-XXXXXXXXXXXXXXXX`)
5. Replace the four AdSense placeholders listed in the summary table above
6. Rebuild and redeploy

> **Note:** `AdSlot` renders nothing in development and nothing for premium users. It only renders in production builds on web browsers.

---

### Google AdMob (Android ads — set up before APK release)

AdMob is separate from AdSense but uses the same Google account.

1. Sign up at [admob.google.com](https://admob.google.com)
2. **Apps → Add app** → Android → Enter app name "TCG Builder" → not yet published
3. Note the **App ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)
4. **Ad units → Add ad unit** → Banner → name it "Main Banner"
5. Note the **Ad Unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`)
6. Replace both AdMob placeholders in the summary table above
7. Run `npm run build && npx cap sync android` and rebuild APK

> **Testing:** During development, set `isTesting: true` in `AndroidBanner.tsx` to use Google's test ad IDs instead of your real ones. Set back to `false` before releasing.

---

### Premium tier / Remove Ads IAP (Android — requires Google Play account)

The premium backend is complete (database column, API endpoint, UI). The only missing piece is wiring a real Google Play in-app purchase to the "Upgrade — Remove Ads" button on the Profile page.

#### Steps

1. **Google Play Console** — [play.google.com/console](https://play.google.com/console): create a developer account ($25 one-time fee)
2. Create your app in Play Console and upload a signed APK to the **internal testing** track
3. Go to **Monetize → Products → In-app products** → Create product:
   - Product ID: `remove_ads`
   - Type: **One-time** (non-consumable)
   - Price: set the minimum (~$0.99 / €0.99)
   - Status: **Active**
4. Install an IAP plugin. Recommended: `cordova-plugin-purchase` (well-maintained, Capacitor-compatible):
   ```bash
   npm install cordova-plugin-purchase
   npx cap sync android
   ```
5. In `frontend/src/pages/ProfilePage.tsx`, replace the stub `handlePurchasePremium` with a real purchase call using the plugin's API. The function must:
   - Initiate purchase for product ID `remove_ads`
   - On success, call `activatePremium(purchaseToken)` (already wired to `POST /api/premium/activate`)
   - Call `refreshPremium()` to update the UI
6. Rebuild and upload to Play Console for testing

> **How premium works:** On successful purchase, the backend sets `is_premium = 1` for the user. `AuthContext` fetches this on every login and exposes `isPremium`. Both `AdSlot` (web) and `AndroidBanner` (Android) return null when `isPremium` is true — ads disappear immediately after purchase without requiring a restart.

---

## 12. Deployment Checklist

### One-time CDK setup
- [ ] `npm install -g aws-cdk` and `aws configure`
- [ ] `cdk bootstrap` (once per account/region)
- [ ] `cdk deploy` — note all outputs (ElasticIp, CloudFrontDomain, InstanceId, bucket names)
- [ ] AMI ID updated for your target region in `tcg-stack.ts`

### Server setup (one-time, via SSM or EC2 Instance Connect)
- [ ] Nginx configured and enabled (`/etc/nginx/sites-available/tcg`)
- [ ] Systemd service file created and enabled
- [ ] Database copied to server (`aws s3 cp` → SSM pull-down)
- [ ] `hash_cards` binary run (for card scanning)

### CI/CD
- [ ] GitHub secrets set (AWS credentials, instance ID, bucket names, CloudFront ID, domain)
- [ ] `.github/workflows/deploy.yml` created with correct values
- [ ] First push to `main` — CI passes end-to-end

### DNS (Cloudflare)
- [ ] CNAME `@` → CloudFront domain, proxied
- [ ] CNAME `www` → CloudFront domain, proxied
- [ ] SSL/TLS set to **Full**

### Monetization — web
- [ ] Ko-Fi username replaced in `Nav.tsx` and `Footer.tsx`
- [ ] AdSense account created and site approved
- [ ] AdSense Publisher ID replaced in `index.html` and `AdSlot.tsx`
- [ ] AdSense slot IDs replaced in `App.tsx` (leaderboard) and `Footer.tsx` (footer)

### Monetization — Android
- [ ] AdMob account created
- [ ] AdMob App ID replaced in `AndroidManifest.xml`
- [ ] AdMob Banner Unit ID replaced in `AndroidBanner.tsx`
- [ ] Google Play Console account created ($25 one-time)
- [ ] `remove_ads` non-consumable in-app product created and set to Active
- [ ] IAP plugin installed and `handlePurchasePremium` stub replaced with real purchase call
- [ ] APK signed and uploaded to Play Console internal testing track

### Every deploy after first setup
- Push to `main` → GitHub Actions runs CDK (no-op if infra unchanged), syncs S3, invalidates CloudFront, deploys binary via SSM automatically
