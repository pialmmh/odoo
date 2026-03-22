#!/bin/bash
#
# Kafka Topic Setup — reads topics.yml, creates missing topics.
# Run after Kafka is up. Idempotent — safe to re-run.
#
# Usage: ./setup-topics.sh [--config topics.yml] [--bootstrap localhost:9092]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${1:-$SCRIPT_DIR/topics.yml}"
BOOTSTRAP="${2:-localhost:9092}"
KAFKA_CMD="docker exec platform-kafka /opt/kafka/bin/kafka-topics.sh"

if [ ! -f "$CONFIG" ]; then
    echo "Config not found: $CONFIG"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Kafka Topic Setup"
echo "═══════════════════════════════════════════"
echo "  Config:    $CONFIG"
echo "  Bootstrap: $BOOTSTRAP"
echo ""

# Parse defaults from YAML (simple grep-based, no yq dependency)
DEFAULT_RF=$(grep -A2 '^defaults:' "$CONFIG" | grep 'replication_factor:' | awk '{print $2}' | tr -d ' ')
DEFAULT_PARTS=$(grep -A2 '^defaults:' "$CONFIG" | grep 'partitions:' | awk '{print $2}' | tr -d ' ')
DEFAULT_RF=${DEFAULT_RF:-1}
DEFAULT_PARTS=${DEFAULT_PARTS:-1}

echo "  Defaults: replication=$DEFAULT_RF, partitions=$DEFAULT_PARTS"
echo ""

# Get existing topics
EXISTING=$($KAFKA_CMD --list --bootstrap-server "$BOOTSTRAP" 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "ERROR: Cannot connect to Kafka at $BOOTSTRAP"
    echo "Make sure Kafka is running: docker compose -f $SCRIPT_DIR/docker-compose.yml up -d"
    exit 1
fi

# Parse topic names from YAML and create if missing
CREATED=0
SKIPPED=0

while IFS= read -r TOPIC; do
    [ -z "$TOPIC" ] && continue

    if echo "$EXISTING" | grep -q "^${TOPIC}$"; then
        echo "  ✓ $TOPIC (exists)"
        SKIPPED=$((SKIPPED + 1))
    else
        # Check for per-topic overrides (not implemented in simple parser — uses defaults)
        $KAFKA_CMD --create \
            --bootstrap-server "$BOOTSTRAP" \
            --topic "$TOPIC" \
            --replication-factor "$DEFAULT_RF" \
            --partitions "$DEFAULT_PARTS" \
            2>/dev/null

        if [ $? -eq 0 ]; then
            echo "  + $TOPIC (created: rf=$DEFAULT_RF, parts=$DEFAULT_PARTS)"
            CREATED=$((CREATED + 1))
        else
            echo "  ✗ $TOPIC (FAILED)"
        fi
    fi
done < <(grep '^\s*- name:' "$CONFIG" | sed 's/.*- name:\s*//' | tr -d ' "'"'"'')

echo ""
echo "Done. Created: $CREATED, Already existed: $SKIPPED"
echo ""
