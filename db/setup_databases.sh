#!/bin/bash
#
# Set up all PostgreSQL databases for the Odoo + Kill Bill platform.
# Run once on a fresh PostgreSQL instance.
#
# PostgreSQL must be running on port 5433 with user 'mustafa' as superuser.
#
# Databases created:
#   1. odoo_billing    — Odoo main database (created by Odoo on first run)
#   2. killbill        — Kill Bill billing engine
#   3. odoo_documents  — Document binary storage (separate from main DB)
#

set -e
PG_PORT=5433
PG_USER=mustafa

echo "=== PostgreSQL Database Setup ==="
echo "Port: $PG_PORT, User: $PG_USER"
echo ""

# ── 1. Ensure user has password (needed for JDBC/TCP connections) ──
echo "Setting password for user $PG_USER..."
sudo -u postgres psql -p $PG_PORT -c "ALTER USER $PG_USER WITH PASSWORD 'mustafa';" 2>/dev/null || true

# ── 2. Create Kill Bill database ──
echo ""
echo "--- Kill Bill Database ---"
if psql -p $PG_PORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='killbill'" | grep -q 1; then
    echo "Database 'killbill' already exists"
else
    psql -p $PG_PORT -d postgres -c "CREATE DATABASE killbill OWNER $PG_USER ENCODING 'UTF8';"
    echo "Created database 'killbill'"
fi

# Load PostgreSQL compatibility DDL (domains, functions, triggers)
echo "Loading Kill Bill PG compatibility DDL..."
psql -p $PG_PORT -d killbill -f "$(dirname "$0")/killbill-pg-compat.sql" 2>&1 | grep -E "(CREATE|ERROR)" || true

# Load main Kill Bill schema
echo "Loading Kill Bill main schema..."
psql -p $PG_PORT -d killbill -f "$(dirname "$0")/killbill-pg-schema.sql" 2>&1 | grep -c "CREATE" | xargs -I{} echo "{} objects created"

# ── 3. Create document storage database ──
echo ""
echo "--- Document Storage Database ---"
if psql -p $PG_PORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='odoo_documents'" | grep -q 1; then
    echo "Database 'odoo_documents' already exists"
else
    psql -p $PG_PORT -d postgres -c "CREATE DATABASE odoo_documents OWNER $PG_USER ENCODING 'UTF8';"
    echo "Created database 'odoo_documents'"
fi

echo "Loading document storage schema..."
psql -p $PG_PORT -d odoo_documents -f "$(dirname "$0")/odoo-documents-schema.sql" 2>&1 | grep -E "(CREATE|already)" || true

# ── 4. Verify ──
echo ""
echo "=== Verification ==="
echo "Databases:"
psql -p $PG_PORT -d postgres -tAc "SELECT datname FROM pg_database WHERE datname IN ('odoo_billing','killbill','odoo_documents') ORDER BY datname"

echo ""
echo "Kill Bill tables:"
psql -p $PG_PORT -d killbill -tAc "SELECT count(*) || ' tables' FROM information_schema.tables WHERE table_schema='public'"

echo "Document storage tables:"
psql -p $PG_PORT -d odoo_documents -tAc "SELECT count(*) || ' tables' FROM information_schema.tables WHERE table_schema='public'"

echo ""
echo "Done. Next steps:"
echo "  1. Start Odoo:     cd .. && ./start-odoo.sh"
echo "  2. Start Kill Bill: cd ../killbill-billing && ./start.sh"
echo "  3. Setup tenant:    cd ../killbill-billing && ./setup-tenant.sh"
