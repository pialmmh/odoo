#!/bin/bash
#
# Launch All Platform Services
# Checks each service, starts if not running, reports status.
#
# Usage: ./launch-all.sh [--status]
#   --status   Only check status, don't start anything
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATUS_ONLY=false
[ "${1:-}" = "--status" ] && STATUS_ONLY=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}●${NC} $1"; }

check_port() {
    curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$1$2" 2>/dev/null
}

wait_for() {
    local port=$1 path=$2 timeout=$3 label=$4
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local code=$(check_port $port "$path")
        if [ "$code" != "000" ]; then
            ok "$label is up (HTTP $code) — port $port"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    fail "$label failed to start within ${timeout}s — port $port"
    return 1
}

echo ""
echo "═══════════════════════════════════════════"
echo "  Telcobright Platform — Service Launcher"
echo "═══════════════════════════════════════════"
echo ""

# ── 1. PostgreSQL (port 5433) ──
echo "PostgreSQL (:5433)"
if pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
    ok "Running"
else
    fail "Not running — start manually or check LXC container"
fi

# ── 2. MySQL (port 3306) ──
echo "MySQL (:3306)"
if mysqladmin -h 127.0.0.1 -P 3306 -u root -p123456 ping &>/dev/null; then
    ok "Running"
else
    warn "Not reachable (needed only for Kill Bill)"
fi

# ── 3. etcd (port 2379) ──
echo "etcd (:2379)"
if etcdctl endpoint health &>/dev/null 2>&1; then
    ok "Running"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting etcd..."
        nohup etcd --data-dir /tmp/etcd-data > /tmp/etcd.log 2>&1 &
        sleep 3
        if etcdctl endpoint health &>/dev/null 2>&1; then ok "etcd started"; else fail "etcd failed"; fi
    fi
fi

# ── 3b. Kafka (port 9092) ──
echo "Kafka (:9092)"
if curl -s --connect-timeout 2 localhost:9092 &>/dev/null || docker exec platform-kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 &>/dev/null 2>&1; then
    ok "Running"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting Kafka (Docker)..."
        (cd "$SCRIPT_DIR/kafka" && docker compose up -d 2>&1 | tail -1)
        # Wait for broker to be ready
        elapsed=0
        while [ $elapsed -lt 30 ]; do
            if docker exec platform-kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 &>/dev/null 2>&1; then
                ok "Kafka started"
                # Setup topics
                "$SCRIPT_DIR/kafka/setup-topics.sh" 2>&1 | grep -E "^\s+[✓+✗]|^Done"
                break
            fi
            sleep 2
            elapsed=$((elapsed + 2))
        done
        [ $elapsed -ge 30 ] && fail "Kafka failed to start within 30s"
    fi
fi

# ── 4. Odoo (port 7169) ──
echo "Odoo (:7169)"
CODE=$(check_port 7169 "/web/login")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting Odoo..."
        nohup "$SCRIPT_DIR/odoo-backend/start-odoo.sh" > /tmp/odoo.log 2>&1 &
        wait_for 7169 "/web/login" 15 "Odoo"
    fi
fi

# ── 5. Keycloak (port 7104) ──
echo "Keycloak (:7104)"
CODE=$(check_port 7104 "/realms/master")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting Keycloak..."
        export KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin
        nohup /opt/keycloak/bin/kc.sh start-dev --http-port=7104 > /tmp/keycloak.log 2>&1 &
        wait_for 7104 "/realms/master" 30 "Keycloak"
    fi
fi

# ── 6. Spring Boot API (port 8180) ──
echo "Spring Boot API (:8180)"
CODE=$(check_port 8180 "/api/odoo/health")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        API_JAR="$SCRIPT_DIR/api/target/platform-api-1.0-SNAPSHOT.jar"
        if [ ! -f "$API_JAR" ]; then
            warn "Building Spring Boot API..."
            (cd "$SCRIPT_DIR/api" && mvn clean package -DskipTests -q 2>&1)
        fi
        warn "Starting Spring Boot API..."
        nohup java -jar "$API_JAR" > /tmp/api.log 2>&1 &
        wait_for 8180 "/api/odoo/health" 15 "Spring Boot API"
    fi
fi

# ── 7. APISIX Gateway (port 9081) ──
echo "APISIX (:9081)"
CODE=$(check_port 9081 "/api/odoo/health")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting APISIX..."
        sudo rm -f /usr/local/apisix/logs/*.sock /usr/local/apisix/logs/*.pid 2>/dev/null
        sudo apisix start > /dev/null 2>&1
        wait_for 9081 "/api/odoo/health" 10 "APISIX"
    fi
fi
# Always ensure APISIX routes are configured (etcd loses data on restart)
ROUTE_COUNT=$(curl -s http://localhost:9180/apisix/admin/routes -H "X-API-KEY: telcobright-apisix-admin-key" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo "0")
if [ "$ROUTE_COUNT" = "0" ] && [ "$STATUS_ONLY" != "true" ]; then
    warn "APISIX routes missing (etcd reset) — re-applying..."
    "$SCRIPT_DIR/apisix/setup-routes.sh" > /dev/null 2>&1 && ok "APISIX routes restored" || fail "APISIX route setup failed"
fi

# ── 8. Kill Bill (port 18080) ──
echo "Kill Bill (:18080)"
CODE=$(check_port 18080 "/1.0/kb/nodesInfo")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting Kill Bill (takes ~60s)..."
        nohup "$SCRIPT_DIR/killbill/start.sh" > /tmp/killbill.log 2>&1 &
        wait_for 18080 "/1.0/kb/nodesInfo" 90 "Kill Bill"
    fi
fi

# ── 9. Vault/OpenBao (port 8200) ──
echo "Vault/OpenBao (:8200)"
CODE=$(check_port 8200 "/v1/sys/health")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        VAULT_DIR="/home/mustafa/telcobright-projects/routesphere/vault"
        if [ -x "$VAULT_DIR/start.sh" ]; then
            warn "Starting Vault (dev mode)..."
            nohup "$VAULT_DIR/start.sh" --dev > /dev/null 2>&1 &
            wait_for 8200 "/v1/sys/health" 10 "Vault"
        else
            warn "Vault not installed at $VAULT_DIR"
        fi
    fi
fi

# ── 10. React UI (port 5180) ──
echo "React UI (:5180)"
CODE=$(check_port 5180 "/")
if [ "$CODE" != "000" ]; then
    ok "Running (HTTP $CODE)"
else
    if [ "$STATUS_ONLY" = true ]; then
        fail "Not running"
    else
        warn "Starting React UI..."
        (cd "$SCRIPT_DIR/ui" && nohup npx vite --port 5180 > /tmp/vite.log 2>&1 &)
        wait_for 5180 "/" 10 "React UI"
    fi
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  URLs"
echo "═══════════════════════════════════════════"
echo ""
echo "  React UI:      http://localhost:5180"
echo "  APISIX Gateway: http://localhost:9081"
echo "  APISIX Admin:  http://localhost:9180"
echo "  Odoo Admin:    http://localhost:7169"
echo "  Keycloak:      http://localhost:7104/admin/"
echo "  Spring Boot:   http://localhost:8180/api/odoo/health"
echo "  Kill Bill:     http://localhost:18080"
echo "  Vault UI:      http://localhost:8200/ui"
echo "  Kafka:         localhost:9092"
echo ""
