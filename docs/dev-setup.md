# Orchestrix-v2 — Dev Setup & Deploy Workflow

Single-source dev onboarding for a fresh Linux PC.

Assumes external services (Postgres, Kafka, Keycloak, etc.) already exist on the
overlay network (`10.10.0.0/16`) reachable via VPN.

---

## 0. Mental model in one diagram

```
   ┌─────────────────────────────────────────────────────────┐
   │  YOUR LAPTOP                                            │
   │                                                         │
   │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
   │  │ Odoo (7170) │  │ Plane API    │  │ Plane web      │ │
   │  │ native      │  │ (7110)       │  │ (7100)         │ │
   │  │ python      │  │ docker stack │  │ pnpm/turbo     │ │
   │  └──────┬──────┘  └──────┬───────┘  └────────────────┘ │
   │         │                │                              │
   │  ┌──────┴──────┐  ┌──────┴────────┐  ┌────────────────┐│
   │  │ Orchestrix  │  │ Spring API    │  │ APISIX gw 9081 ││
   │  │ UI (5180)   │  │ (8180)        │  │                ││
   │  │ vite legacy │  │ java          │  │                ││
   │  └─────────────┘  └───────────────┘  └────────────────┘│
   │                                                         │
   └────────────────────────┬────────────────────────────────┘
                            │ WireGuard tunnel
                            ▼
   ┌─────────────────────────────────────────────────────────┐
   │  OVERLAY NETWORK 10.10.0.0/16                           │
   │  ┌────────────────────────┐  ┌──────────────────────┐  │
   │  │ Postgres 10.10.199.41  │  │ (Keycloak, Kafka,    │  │
   │  │ db = platform_staging  │  │  etcd, ... if remote)│  │
   │  └────────────────────────┘  └──────────────────────┘  │
   └─────────────────────────────────────────────────────────┘
```

**Single source of truth for every tenant config:**

```
tools/deploy/operators/<operator>/<profile>.yml
   │
   ▼ load-yaml.sh → CONF_* env vars
   ▼ render-template.sh fills {{key}} placeholders
   ▼
rendered config files appear under (all gitignored):
   odoo-backend-19/profiles/<op>-<profile>/
   odoo-backend-19/plane/profiles/<op>-<profile>/
```

---

## 1. One-time system prereqs

```bash
# Base (most likely already present on Debian 12)
sudo apt install -y git curl wireguard

# Language runtimes (versions matter)
sudo apt install -y python3 python3-venv python3-pip      # Python 3.12+ (Odoo)
sudo apt install -y openjdk-21-jdk maven                  # Java 21 (seed-data, Spring API)
sudo apt install -y postgresql-client                     # psql for poking the DB
curl -fsSL https://get.docker.com | sh                    # Docker + compose plugin
sudo usermod -aG docker "$USER" && newgrp docker          # docker without sudo

# Node 22 + pnpm (via nvm)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install 22
npm install -g pnpm
```

---

## 2. VPN — reach the overlay network

The remote services live on `10.10.0.0/16` (WireGuard tunneled). Before
anything else can talk to the remote Postgres, bring the tunnel up:

```bash
sudo wg-quick up <your-config-name>   # configs live under /etc/wireguard/
ping 10.10.199.41                     # MUST succeed before continuing
```

To make it auto-start at boot:

```bash
sudo systemctl enable wg-quick@<your-config-name>
```

---

## 3. Clone repo + bootstrap subsystems

One-time setup per checkout (~10 minutes total):

```bash
git clone git@github.com:pialmmh/odoo.git orchestrix-v2
cd orchestrix-v2

# (a) Odoo source + Python venv  ─ ~5 min
cd odoo-backend-19
git clone --branch 19.0 --depth 1 https://github.com/odoo/odoo.git odoo-src
python3 -m venv venv
./venv/bin/pip install --upgrade pip wheel setuptools
./venv/bin/pip install -r odoo-src/requirements.txt
cd ..

# (b) Plane workspace (api + web + ~11 @plane/* packages)  ─ ~45 s
cd odoo-backend-19/plane && pnpm install && cd ../..

# (c) Orchestrix legacy UI deps
cd ui && npm install && cd ..

# (d) seed-data Java tool (only needed when DB seeding is required)
cd tools/deploy/seed-data && mvn -q package && cd ../../..
```

---

## 4. Render env files from your operator+profile

```bash
./tools/deploy/deploy_env.sh btcl dev --all --local
```

This **does not start services** — only writes config files.

What gets written:

| Source                                     | Destination |
|-------------------------------------------|-------------|
| `tools/deploy/operators/btcl/dev.yml`     | (source of truth — already in git) |
| `templates/odoo.conf.tmpl`                | `odoo-backend-19/profiles/btcl-dev/odoo.conf` |
| `templates/plane-api.env.tmpl`            | `odoo-backend-19/plane/profiles/btcl-dev/api.env` |
| `templates/plane-web.env.tmpl`            | `odoo-backend-19/plane/profiles/btcl-dev/web.env` |
| `templates/plane-compose.override.yml.tmpl` | `odoo-backend-19/plane/profiles/btcl-dev/compose.override.yml` |

Then `api.env` is copied to `apps/api/.env` (Plane docker reads this) and
`web.env` is copied to `apps/web/.env` (Vite reads this).

All rendered files are gitignored — re-run `deploy_env.sh` whenever you edit
the YAML or templates.

---

## 5. Start everything

```bash
./launch-all.sh
```

`launch-all.sh` is **idempotent**. For each service it checks the port first
and skips if already up.

Service order:

| # | Service | Port | How it's started |
|---|---------|------|------------------|
| 1 | Postgres | 5433 (local) or 5432 (remote) | Already running externally |
| 2 | MySQL | 3306 | Only used by Kill Bill |
| 3 | etcd | 2379 | `nohup etcd ...` (auto-starts local) |
| 4 | Kafka | 9092 | `docker compose up -d` in `kafka/` |
| 5 | **Odoo dev** | **7170** | `deploy.sh btcl dev --components odoo --local --skip-build` |
| 6 | **Plane API** | **7110** | `deploy.sh btcl dev --components plane --local --skip-build` (docker) |
| 7 | **Plane web** | **7100** | `pnpm turbo run dev --filter=web... --concurrency=18 -- --port 7100` — **cold start 3-5 min** |
| 8 | Keycloak | 7104 | local `kc.sh start-dev` (or remote) |
| 9 | Spring Boot API | 8180 | `java -jar` |
| 10 | APISIX | 9081 | `sudo apisix start` (routes auto-restored from etcd) |
| 11 | Kill Bill | 18080 | `killbill/start.sh` (~60 s) |
| 12 | Vault | 8200 | `routesphere/vault/start.sh` |
| 13 | **Orchestrix UI (legacy)** | **5180** | `vite --port 5180` |

After `launch-all.sh` finishes, the URL banner prints. Key user-facing URLs:

- **Plane UI (new prod direction)** — http://localhost:7100/btcl/crm/leads
- **Orchestrix UI (legacy)** — http://localhost:5180
- **Odoo admin** — http://localhost:7170/web/login (admin / admin)

---

## 6. What survives reboot vs needs re-launch

| Layer | Survives reboot? | Why / how to restart |
|---|---|---|
| Rendered config files | ✅ Just files | Re-run `deploy_env.sh` if YAML changes |
| Plane API containers (api, worker, beat-worker, migrator, redis, mq, minio) | ✅ `restart: unless-stopped` policy + Docker daemon auto-start | Docker re-binds the ports automatically |
| Plane API named volumes (`*_redisdata`, `*_uploads`, `*_rabbitmq_data`) | ✅ Survive `down`; only die on `down --volumes` | Persistent state |
| Plane source bind-mount (`apps/api:/code`) | ✅ Host filesystem | Edits in your editor → Django autoreloads in-container |
| Odoo native process | ❌ no systemd unit | Re-run `./launch-all.sh` |
| Plane web turbo dev | ❌ no systemd unit | Re-run `./launch-all.sh` (3-5 min cold restart) |
| Orchestrix UI vite | ❌ no systemd unit | Re-run `./launch-all.sh` |
| WireGuard | ❌ unless enabled in systemd | `sudo systemctl enable wg-quick@<cfg>` |

---

## 7. Daily edit-reload loop

| You edit | Where it runs | Reload how |
|---|---|---|
| `ui/src/**` | Vite on :5180 | **Automatic** HMR (~200 ms) |
| `odoo-backend-19/plane/apps/web/**` | Vite/react-router on :7100 | **Automatic** HMR + Fast Refresh |
| `odoo-backend-19/plane/apps/api/**/*.py` | Django in container on :7110 | **Automatic** runserver autoreload (bind-mount + watcher) |
| `odoo-backend-19/plane/packages/**` | `tsdown --watch` (one per package) | **Automatic** — rebuilds dist/, Vite picks up |
| `odoo-backend-19/custom-addons/**` | Odoo on :7170 | **Manual** — restart Odoo or launch with `--dev=reload,xml,assets` |
| `odoo-backend-19/plane/apps/api/requirements/*.txt` | Inside docker image | `deploy.sh btcl dev --components plane --local` (drop `--skip-build`) |
| `tools/deploy/operators/btcl/dev.yml` | YAML source of truth | `deploy_env.sh btcl dev --all --local` |
| Any `templates/*.tmpl` | Source of truth | `deploy_env.sh btcl dev --components <comp> --local` |
| `tools/deploy/templates/plane-compose.override.yml.tmpl` | Compose override | `deploy.sh btcl dev --components plane --local --skip-build` (recreates containers) |

---

## 8. Production ship — env bundle

To deploy this profile's config to a real production server (binaries are a
separate concern):

```bash
# 1. Render + pack
./tools/deploy/deploy_env.sh btcl prod --all --bundle /tmp/btcl-prod-env.tgz

# 2. Ship
scp /tmp/btcl-prod-env.tgz prod-host:/opt/orchestrix/

# 3. Expand on the remote host
ssh prod-host 'cd /opt/orchestrix && tar xzf btcl-prod-env.tgz'
```

The bundle contains only config/env files. Binaries (compiled Java, built
Plane web, etc.) are shipped separately by the main deploy flow.

---

## 9. Troubleshooting

| Symptom | First check |
|---|---|
| `psql: connection timeout` to 10.10.199.41 | VPN: `ip route show 10.10.0.0/16`; `ping 10.10.199.41` |
| Odoo :7170 returns 000 | `tail -50 odoo-backend-19/logs/odoo-btcl-dev.log` |
| Plane API :7110 returns 000 | `docker compose -p plane-btcl-dev ... logs api` |
| Plane web :7100 returns 500 with `Failed to resolve entry for package "@plane/constants"` | Turbo didn't finish building packages — wait or check `/tmp/plane-web.log` |
| `ERROR: profile yaml not found` | `ls tools/deploy/operators/btcl/*.yml` |
| `WARN: unrendered placeholders` | A `{{key}}` in a template has no matching YAML key — add it or remove the placeholder |
| docker compose port collisions on :9090 / :6379 / :5432 | The override template (`plane-compose.override.yml.tmpl`) clears those — verify the rendered `compose.override.yml` includes `ports: !reset []` |
| PC slows down after `launch-all.sh` | Most likely Plane web turbo cold start (8 tsdown workers). Wait, don't restart |

---

## 10. New-PC checklist (TL;DR)

```bash
# Phase 1: prereqs (~10 min one-time)
sudo apt install -y git curl wireguard python3 python3-venv openjdk-21-jdk maven postgresql-client
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker "$USER"
# install nvm + node 22 + pnpm

# Phase 2: VPN
sudo wg-quick up <config>; ping 10.10.199.41

# Phase 3: bootstrap repo (~10 min one-time)
git clone git@github.com:pialmmh/odoo.git orchestrix-v2 && cd orchestrix-v2
cd odoo-backend-19 && git clone --branch 19.0 --depth 1 https://github.com/odoo/odoo.git odoo-src \
  && python3 -m venv venv && ./venv/bin/pip install -r odoo-src/requirements.txt && cd ..
cd odoo-backend-19/plane && pnpm install && cd ../..
cd ui && npm install && cd ..
cd tools/deploy/seed-data && mvn -q package && cd ../../..

# Phase 4: render configs
./tools/deploy/deploy_env.sh btcl dev --all --local

# Phase 5: start everything
./launch-all.sh

# → http://localhost:7100/btcl/crm/leads  (new UI)
# → http://localhost:5180                  (legacy UI for comparison)
# → http://localhost:7170/web/login        (Odoo admin)
```

Day-to-day after that = `./launch-all.sh` (idempotent) + your editor.

---

## File-by-file reference for the deploy framework

| File | Role |
|---|---|
| `tools/deploy/deploy.sh` | Main entrypoint |
| `tools/deploy/deploy_env.sh` | Shortcut: `deploy.sh ... --env-only` |
| `tools/deploy/operators/<op>/<profile>.yml` | Per-tenant per-profile YAML (flat keys) |
| `tools/deploy/lib/load-yaml.sh` | YAML → `CONF_*` env loader (Python+PyYAML) |
| `tools/deploy/lib/render-template.sh` | `{{key}}` → value substitution |
| `tools/deploy/lib/ssh.sh` | Remote-deploy helpers |
| `tools/deploy/components/<name>.sh` | Two-phase component: `render_<name>_env()` + `deploy_<name>()` |
| `tools/deploy/templates/<name>.tmpl` | Placeholder-based config templates |
| `tools/deploy/seed-data/` | Java tool: provisions a tenant Postgres DB |
| `tools/deploy/README.md` | Framework workflow guide (richer than this doc) |
