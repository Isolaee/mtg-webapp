# Deployment Setup Plan

**Stack:** AWS Lightsail (server) · Cloudflare (domain + CDN) · GitHub Actions (CI/CD)

---

## Overview

```
GitHub Actions
  ├── build React → frontend/build/
  ├── build Rust  → tcg-backend binary
  └── SSH deploy to Lightsail
        ├── nginx serves /        → frontend/build/ (static)
        └── nginx proxies /api    → Axum on :8080
                                        └── SQLite on disk
Cloudflare sits in front:
  DNS A record → Lightsail static IP
  SSL terminated at Cloudflare edge
  Origin certificate on nginx
```

---

## 1. AWS Lightsail Instance

### Create the instance

1. Go to [AWS Lightsail](https://lightsail.aws.amazon.com)
2. **Create instance** → Linux/Unix → OS Only → **Ubuntu 22.04 LTS**
3. Plan: **$5/mo** (1 vCPU, 1 GB RAM) — enough for the Rust binary + nginx + SQLite
4. Name it (e.g. `tcg-server`)
5. After creation: **Networking → Create static IP** → attach to the instance
   - Note this IP — you'll need it for Cloudflare DNS

### Open firewall ports

In the Lightsail **Networking** tab, add rules:
- HTTP — port 80 (needed for Cloudflare → server traffic)
- HTTPS — port 443 (if using origin cert)
- SSH — port 22 (GitHub Actions deploy)

### Server dependencies

SSH into the instance, then:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx

# Create app directories
sudo mkdir -p /var/www/tcg          # React static files
sudo mkdir -p /var/lib/tcg          # SQLite database + binary
sudo chown ubuntu:ubuntu /var/www/tcg /var/lib/tcg
```

---

## 2. Cloudflare Domain Setup

### Add your domain

1. Sign up at [cloudflare.com](https://cloudflare.com) (free plan is fine)
2. Add your domain → follow instructions to update nameservers at your registrar
3. In **DNS** → Add record:
   - Type: `A`
   - Name: `@` (root domain) and `www`
   - IPv4: your Lightsail static IP
   - Proxy status: **Proxied** (orange cloud)

### SSL settings

In **SSL/TLS** → set mode to **Full (strict)**

Generate an origin certificate (trusted between Cloudflare and your server):

1. **SSL/TLS → Origin Server → Create Certificate**
2. Choose wildcard (`*.yourdomain.com` + `yourdomain.com`)
3. Copy the **Certificate** and **Private Key** — you'll install these on the server

On the Lightsail instance:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo nano /etc/nginx/ssl/cloudflare.pem    # paste Certificate here
sudo nano /etc/nginx/ssl/cloudflare.key    # paste Private Key here
sudo chmod 600 /etc/nginx/ssl/cloudflare.key
```

---

## 3. Nginx Configuration

Create `/etc/nginx/sites-available/tcg`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/cloudflare.pem;
    ssl_certificate_key /etc/nginx/ssl/cloudflare.key;

    # Serve React app
    root /var/www/tcg;
    index index.html;

    # API proxy to Axum
    location /api/ {
        proxy_pass         http://127.0.0.1:8080/api/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 10M;   # for card scan image uploads
    }

    # React Router — all unknown paths serve index.html
    location / {
        try_files $uri /index.html;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/tcg /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Systemd Service

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
Environment=JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
Environment=RUST_LOG=tcg_backend=info,tower_http=info

[Install]
WantedBy=multi-user.target
```

Enable it (don't start yet — binary isn't deployed):

```bash
sudo systemctl daemon-reload
sudo systemctl enable tcg-backend
```

Generate a JWT secret:

```bash
openssl rand -hex 32
# paste the output as JWT_SECRET in the service file above
sudo systemctl daemon-reload
```

---

## 5. GitHub Repository Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `LIGHTSAIL_HOST` | Your Lightsail static IP |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Contents of your SSH private key (see below) |

### Generate a deploy SSH key

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/tcg_deploy -N ""
# Add the public key to the server:
cat ~/.ssh/tcg_deploy.pub >> ~/.ssh/authorized_keys   # run on the server
# Copy private key contents into the LIGHTSAIL_SSH_KEY secret:
cat ~/.ssh/tcg_deploy   # copy this into GitHub
```

---

## 6. GitHub Actions Workflow

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

      # ── Frontend ──────────────────────────────────────────────────────
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Build React app
        working-directory: frontend
        env:
          REACT_APP_API_URL: https://yourdomain.com/api
        run: |
          npm ci
          npm run build

      # ── Backend ───────────────────────────────────────────────────────
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-unknown-linux-gnu

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: backend-rust

      - name: Build Rust backend
        working-directory: backend-rust
        run: cargo build --release

      # ── Deploy ────────────────────────────────────────────────────────
      - name: Deploy to Lightsail
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            sudo systemctl stop tcg-backend || true

      - name: Upload frontend
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          source: frontend/build/
          target: /var/www/tcg/
          strip_components: 2

      - name: Upload backend binary
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          source: backend-rust/target/release/tcg-backend
          target: /var/lib/tcg/
          strip_components: 4

      - name: Start backend service
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: ${{ secrets.LIGHTSAIL_USER }}
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            chmod +x /var/lib/tcg/tcg-backend
            sudo systemctl start tcg-backend
            sleep 2
            curl -sf http://localhost:8080/health || (sudo journalctl -u tcg-backend -n 20 && exit 1)
```

---

## 7. Initial Data Setup (one-time)

The SQLite database with 34,000+ MTG cards must be copied to the server manually — it's too large to commit to git.

```bash
# From your local machine:
scp -i ~/.ssh/tcg_deploy database/mtg_card_db.db ubuntu@<LIGHTSAIL_IP>:/var/lib/tcg/
```

### Seed Riftbound cards (if not already in the DB)

```bash
# SSH into the server, after first deploy:
cd /var/lib/tcg
DATABASE_URL="sqlite:./mtg_card_db.db" ./seed_riftbound
```

### Populate card hashes (required for card scanning)

This downloads card art and computes perceptual hashes (~1–2 hours, run once):

```bash
# SSH into the server:
DATABASE_URL="sqlite:./mtg_card_db.db" /var/lib/tcg/hash_cards
```

To also deploy the utility binaries via CI, add them to the upload step in the workflow:
```
source: backend-rust/target/release/hash_cards,backend-rust/target/release/seed_riftbound
```

---

## 8. Android Build

Once the server is live at `yourdomain.com`:

```bash
# In frontend/
# .env.production already has the placeholder — update it:
echo "REACT_APP_API_URL=https://yourdomain.com/api" > .env.production

npm run build
npx cap sync android
npx cap open android    # Build → Build APK(s) in Android Studio
```

The CORS config in `backend-rust/src/main.rs` already allows `capacitor://localhost`.

---

## 9. Database Backups

Add a daily backup cron on the server:

```bash
crontab -e
# Add:
0 3 * * * cp /var/lib/tcg/mtg_card_db.db /var/lib/tcg/backups/mtg_card_db_$(date +\%Y\%m\%d).db
0 3 * * * find /var/lib/tcg/backups/ -name "*.db" -mtime +14 -delete
```

For off-server backup, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and sync to an S3 bucket:

```bash
0 4 * * * aws s3 cp /var/lib/tcg/mtg_card_db.db s3://your-bucket/backups/mtg_card_db_$(date +\%Y\%m\%d).db
```

---

## 10. Deployment Checklist

First-time setup:
- [ ] Lightsail instance created with static IP
- [ ] Firewall ports 80, 443, 22 open
- [ ] Nginx installed and configured
- [ ] Cloudflare domain added, DNS A record set, SSL set to Full (strict)
- [ ] Cloudflare origin certificate installed on server
- [ ] Systemd service file created with real `JWT_SECRET`
- [ ] GitHub secrets set (`LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, `LIGHTSAIL_SSH_KEY`)
- [ ] `.github/workflows/deploy.yml` created with correct domain
- [ ] Database copied to server (`scp database/mtg_card_db.db ...`)
- [ ] First deploy pushed to `main` → CI passes
- [ ] `hash_cards` binary run on server (for card scanning)

Every deploy after that:
- Push to `main` → GitHub Actions builds and deploys automatically
