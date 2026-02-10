#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_PATH="${SCRIPT_DIR}/jts.ini"

if ! command -v gcloud >/dev/null 2>&1; then
    echo "gcloud CLI is required."
    exit 1
fi

PROJECT_ID="${GCP_PROJECT_ID:-wheel-strat}"
INSTANCE_ID="${IBKR_BRIDGE_INSTANCE_ID:-1568556415025546399}"
INSTANCE_NAME="${IBKR_BRIDGE_INSTANCE_NAME:-ibkr-bridge}"
EXTERNAL_IP="${IBKR_BRIDGE_EXTERNAL_IP:-35-224-187-242}"
ZONE="${GCP_ZONE:-}"

resolve_prod_target() {
    if [ -z "$ZONE" ] || [ -z "$INSTANCE_NAME" ]; then
        FILTER=""
        if [ -n "$INSTANCE_ID" ]; then
            FILTER="id=$INSTANCE_ID"
        elif [ -n "$EXTERNAL_IP" ]; then
            FILTER="EXTERNAL_IP=$EXTERNAL_IP"
        elif [ -n "$INSTANCE_NAME" ]; then
            FILTER="name=$INSTANCE_NAME"
        fi

        if [ -n "$FILTER" ]; then
            INSTANCE_INFO=$(gcloud compute instances list --project="$PROJECT_ID" --filter="$FILTER" --format="value(name,zone)" | head -n 1)
            if [ -n "$INSTANCE_INFO" ]; then
                INSTANCE_NAME="$(echo "$INSTANCE_INFO" | awk '{print $1}')"
                ZONE="$(echo "$INSTANCE_INFO" | awk '{print $2}')"
            fi
        fi
    fi

    if [ -z "$ZONE" ] || [ -z "$INSTANCE_NAME" ]; then
        echo "Unable to determine instance/zone. Set GCP_ZONE or IBKR_BRIDGE_INSTANCE_ID/IBKR_BRIDGE_INSTANCE_NAME."
        exit 1
    fi
}

resolve_prod_target

echo "Downloading jts.ini from ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" \
    "${INSTANCE_NAME}:/home/ibgateway/Jts/jts.ini" \
    "$TARGET_PATH"
echo "Saved to ${TARGET_PATH}"
