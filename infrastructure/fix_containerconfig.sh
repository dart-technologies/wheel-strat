#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "Usage:"
    echo "  ./fix_containerconfig.sh"
    echo "  ./fix_containerconfig.sh --prod"
    echo "  ./fix_containerconfig.sh --bridge-only"
    echo "  ./fix_containerconfig.sh --remove-image"
    echo ""
    echo "Options:"
    echo "  --prod          Run on the GCP VM via gcloud ssh."
    echo "  --bridge-only   Only rebuild bridge-api (skip ib-gateway cleanup)."
    echo "  --remove-image  Remove gnzsnz/ib-gateway:latest before pulling."
}

BRIDGE_ONLY=0
REMOVE_IMAGE=0
PROD=0

for arg in "$@"; do
    case "$arg" in
        --prod)
            PROD=1
            ;;
        --bridge-only)
            BRIDGE_ONLY=1
            ;;
        --remove-image)
            REMOVE_IMAGE=1
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            usage
            exit 1
            ;;
    esac
done

resolve_prod_target() {
    PROJECT_ID="${GCP_PROJECT_ID:-wheel-strat}"
    INSTANCE_ID="${IBKR_BRIDGE_INSTANCE_ID:-1568556415025546399}"
    INSTANCE_NAME="${IBKR_BRIDGE_INSTANCE_NAME:-ibkr-bridge}"
    EXTERNAL_IP="${IBKR_BRIDGE_EXTERNAL_IP:-35-224-187-242}"
    ZONE="${GCP_ZONE:-}"

    if [ -z "$ZONE" ] || [ -z "$INSTANCE_NAME" ] || [ -z "$EXTERNAL_IP" ]; then
        FILTER=""
        if [ -n "$INSTANCE_ID" ]; then
            FILTER="id=$INSTANCE_ID"
        elif [ -n "$EXTERNAL_IP" ]; then
            FILTER="EXTERNAL_IP=$EXTERNAL_IP"
        elif [ -n "$INSTANCE_NAME" ]; then
            FILTER="name=$INSTANCE_NAME"
        fi

        if [ -n "$FILTER" ]; then
            INSTANCE_INFO=$(gcloud compute instances list --project="$PROJECT_ID" --filter="$FILTER" --format="value(name,zone,networkInterfaces[0].accessConfigs[0].natIP)" | head -n 1)
            if [ -n "$INSTANCE_INFO" ]; then
                INSTANCE_NAME="$(echo "$INSTANCE_INFO" | awk '{print $1}')"
                ZONE="$(echo "$INSTANCE_INFO" | awk '{print $2}')"
                if [ -z "$EXTERNAL_IP" ]; then
                    EXTERNAL_IP="$(echo "$INSTANCE_INFO" | awk '{print $3}')"
                fi
            fi
        fi
    fi

    if [ -z "$ZONE" ]; then
        echo "Unable to determine zone. Set GCP_ZONE or IBKR_BRIDGE_INSTANCE_ID/IBKR_BRIDGE_EXTERNAL_IP."
        exit 1
    fi
}

if [ "$PROD" -eq 1 ] && [ -z "${FIX_CONTAINERCONFIG_REMOTE:-}" ]; then
    if ! command -v gcloud >/dev/null 2>&1; then
        echo "gcloud CLI is required for --prod."
        exit 1
    fi
    resolve_prod_target
    REMOTE_FLAGS=()
    if [ "$BRIDGE_ONLY" -eq 1 ]; then
        REMOTE_FLAGS+=("--bridge-only")
    fi
    if [ "$REMOVE_IMAGE" -eq 1 ]; then
        REMOTE_FLAGS+=("--remove-image")
    fi
    echo "Running on ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
    gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$SCRIPT_DIR/fix_containerconfig.sh" \
        "${INSTANCE_NAME}:~/wheel-strat/infrastructure/fix_containerconfig.sh"
    gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
        --command="cd ~/wheel-strat/infrastructure && chmod +x ./fix_containerconfig.sh && FIX_CONTAINERCONFIG_REMOTE=1 bash ./fix_containerconfig.sh ${REMOTE_FLAGS[*]}"
    exit 0
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    COMPOSE_LABEL="docker compose"
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    COMPOSE_LABEL="docker-compose"
else
    echo "Docker Compose not available. Install docker compose plugin or docker-compose."
    exit 1
fi

if docker info >/dev/null 2>&1; then
    SUDO=()
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    SUDO=(sudo)
else
    echo "Docker daemon is not running. Start Docker and retry."
    exit 1
fi

cd "$SCRIPT_DIR"

echo "Using ${COMPOSE_LABEL}."

if [ "$BRIDGE_ONLY" -eq 0 ]; then
    echo "Removing ib-gateway container (ContainerConfig fix)..."
    "${SUDO[@]}" "${COMPOSE_CMD[@]}" rm -sf ib-gateway || true

    if [ "$REMOVE_IMAGE" -eq 1 ]; then
        echo "Removing gnzsnz/ib-gateway:latest image..."
        "${SUDO[@]}" docker image rm -f gnzsnz/ib-gateway:latest || true
    fi

    echo "Pulling fresh ib-gateway image..."
    "${SUDO[@]}" "${COMPOSE_CMD[@]}" pull ib-gateway

    echo "Starting ib-gateway..."
    "${SUDO[@]}" "${COMPOSE_CMD[@]}" up -d ib-gateway
fi

echo "Rebuilding bridge-api without deps..."
"${SUDO[@]}" "${COMPOSE_CMD[@]}" up -d --build --no-deps bridge-api

echo "Done."
