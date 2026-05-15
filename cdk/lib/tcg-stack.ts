import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface TcgStackProps extends cdk.StackProps {
  certificate: acm.ICertificate;
}

export class TcgStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TcgStackProps) {
    super(scope, id, props);

    const region = this.region;
    const account = this.account;

    // ── JWT secret ─────────────────────────────────────────────────────────
    // Generated once by CDK; EC2 user-data pulls it at boot.
    // Rotate via Secrets Manager console without redeploying the stack.
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'tcg/jwt-secret',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    // ── VPC ────────────────────────────────────────────────────────────────
    // Default VPC — avoids NAT gateway costs for a small single-instance app.
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // ── Security group ─────────────────────────────────────────────────────
    // No port 22 — all remote access goes through SSM Session Manager.
    const sg = new ec2.SecurityGroup(this, 'BackendSg', {
      vpc,
      description: 'TCG backend - HTTP/HTTPS only; SSH via SSM',
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP from CloudFront');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80),  'HTTP from CloudFront (IPv6)');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'HTTPS (IPv6)');

    // ── IAM role for EC2 ───────────────────────────────────────────────────
    const instanceRole = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // SSM: enables Session Manager (browser SSH) + SendCommand from CI/CD
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    jwtSecret.grantRead(instanceRole);

    // ── S3: database backups ───────────────────────────────────────────────
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `tcg-db-backups-${account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        id: 'expire-old-backups',
        expiration: cdk.Duration.days(30),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never accidentally destroy backups
    });
    backupBucket.grantReadWrite(instanceRole);

    // ── S3: frontend static hosting ────────────────────────────────────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `tcg-frontend-${account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── EC2 user data ──────────────────────────────────────────────────────
    // Runs once on first boot. Sets up nginx, SSM agent, app directories,
    // and writes the JWT secret into the systemd drop-in.
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euo pipefail',
      'export DEBIAN_FRONTEND=noninteractive',
      'apt-get update -y',
      'apt-get install -y nginx awscli',

      // SSM agent (snap version works on Ubuntu 22.04 out of the box)
      'snap install amazon-ssm-agent --classic',
      'systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service',
      'systemctl start  snap.amazon-ssm-agent.amazon-ssm-agent.service',

      // App directories
      'mkdir -p /var/lib/tcg/backups',
      'chown ubuntu:ubuntu /var/lib/tcg /var/lib/tcg/backups',

      // Pull JWT secret and write systemd drop-in so the service picks it up
      `export JWT=$(aws secretsmanager get-secret-value \
        --secret-id tcg/jwt-secret \
        --query SecretString \
        --output text \
        --region ${region})`,
      'mkdir -p /etc/systemd/system/tcg-backend.service.d',
      'printf "[Service]\\nEnvironment=JWT_SECRET=%s\\n" "$JWT" \
        > /etc/systemd/system/tcg-backend.service.d/secret.conf',
      'chmod 600 /etc/systemd/system/tcg-backend.service.d/secret.conf',

      // Nginx config: proxy /api/* and /health to Axum; 404 everything else
      // (frontend is served by CloudFront/S3, not nginx)
      'cat > /etc/nginx/sites-available/tcg << \'NGINX_EOF\'',
      'server {',
      '    listen 80 default_server;',
      '    location /api/ {',
      '        proxy_pass         http://127.0.0.1:8080/api/;',
      '        proxy_set_header   Host $host;',
      '        proxy_set_header   X-Real-IP $remote_addr;',
      '        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header   X-Forwarded-Proto $scheme;',
      '        client_max_body_size 10M;',
      '    }',
      '    location /health {',
      '        proxy_pass http://127.0.0.1:8080/health;',
      '    }',
      '    location / { return 404; }',
      '}',
      'NGINX_EOF',
      'ln -sf /etc/nginx/sites-available/tcg /etc/nginx/sites-enabled/tcg',
      'rm -f /etc/nginx/sites-enabled/default',
      'nginx -t && systemctl enable nginx && systemctl restart nginx',

      // Systemd service for the Rust backend (binary not yet present — that's CI's job)
      'cat > /etc/systemd/system/tcg-backend.service << \'SVC_EOF\'',
      '[Unit]',
      'Description=TCG Builder Backend',
      'After=network.target',
      '[Service]',
      'User=ubuntu',
      'WorkingDirectory=/var/lib/tcg',
      'ExecStart=/var/lib/tcg/tcg-backend',
      'Restart=on-failure',
      'RestartSec=5',
      'Environment=DATABASE_URL=sqlite:/var/lib/tcg/mtg_card_db.db',
      'Environment=RUST_LOG=tcg_backend=info,tower_http=info',
      '[Install]',
      'WantedBy=multi-user.target',
      'SVC_EOF',
      'systemctl daemon-reload',
      'systemctl enable tcg-backend',
    );

    // ── EC2 instance ───────────────────────────────────────────────────────
    const instance = new ec2.Instance(this, 'Backend', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      // Dynamic lookup: finds the latest Ubuntu 22.04 LTS ARM64 AMI in whatever region is active.
      machineImage: ec2.MachineImage.lookup({
        name: 'ubuntu/images/hvm-ssd*ubuntu-jammy-22.04-arm64-server-*',
        owners: ['099720109477'], // Canonical Ltd
      }),
      securityGroup: sg,
      role: instanceRole,
      userData,
      userDataCausesReplacement: false, // user-data runs once at launch; don't replace on changes
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(8, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted: true,
        }),
      }],
      requireImdsv2: true,
      detailedMonitoring: false, // saves ~$3/mo; enable if you add CloudWatch alarms
    });

    // ── Elastic IP ─────────────────────────────────────────────────────────
    // Stable public IP — Cloudflare A record for the API origin points here.
    const eip = new ec2.CfnEIP(this, 'BackendEip', {
      domain: 'vpc',
    });
    new ec2.CfnEIPAssociation(this, 'BackendEipAssoc', {
      instanceId: instance.instanceId,
      allocationId: eip.attrAllocationId,
    });

    // ── CloudFront ─────────────────────────────────────────────────────────
    // Serves the frontend from S3 only. The API is accessed directly via the
    // EIP — configure an A record in Cloudflare for api.yourdomain.com → EIP,
    // then set REACT_APP_API_URL=https://api.yourdomain.com/api at build time.
    // CloudFront cannot use a raw IP as an origin (AWS restriction).
    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOac', {
      description: 'TCG frontend bucket OAC',
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'TCG website CDN',

      domainNames: ['tcg-singularity.com', 'www.tcg-singularity.com'],
      certificate: props.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,

      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },

      defaultRootObject: 'index.html',

      // React Router: unknown paths serve index.html (client-side routing)
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    // Allow CloudFront to read from the frontend bucket via OAC
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [frontendBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    // Allow EC2 to stage the binary into the frontend bucket during CI
    frontendBucket.grantReadWrite(instanceRole);

    // ── Outputs ────────────────────────────────────────────────────────────
    // These values go into GitHub Actions secrets and the Cloudflare DNS record.
    new cdk.CfnOutput(this, 'ElasticIp', {
      value: eip.ref,
      description: 'EC2 public IP — set Cloudflare A record: api.yourdomain.com → this IP',
    });
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain — set Cloudflare CNAME: @ (root) → this value',
    });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'Used by GitHub Actions to invalidate the CloudFront cache on deploy',
    });
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'GitHub Actions uploads the React build here',
    });
    new cdk.CfnOutput(this, 'BackupBucketName', {
      value: backupBucket.bucketName,
      description: 'Daily SQLite backups land here',
    });
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'Used by GitHub Actions ssm send-command to deploy the binary',
    });
  }
}
