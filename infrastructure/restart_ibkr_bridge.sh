#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
MODE="${1:-local}"

if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ENV_FILE"
    set +a
fi

usage() {
    echo "Usage:"
    echo "  ./restart_ibkr_bridge.sh                    # restart local docker stack"
    echo "  ./restart_ibkr_bridge.sh --prod             # reboot prod VM"
    echo "  ./restart_ibkr_bridge.sh --prod-restart     # restart docker-compose on prod VM"
    echo "  ./restart_ibkr_bridge.sh --prod-update-env  # scp infrastructure/.env to prod VM"
    echo "  ./restart_ibkr_bridge.sh --prod-health      # curl prod /health"
    echo "  ./restart_ibkr_bridge.sh --prod-fix-containerconfig # run ContainerConfig fix on prod VM"
    echo "  ./restart_ibkr_bridge.sh --prod-all         # update env, restart, then health check"
    echo "  ./restart_ibkr_bridge.sh --prod-sync-bridge # scp scripts/bridge/ibkr_bridge.py to prod (no git)"
    echo "  ./restart_ibkr_bridge.sh --prod-rebuild-bridge # sync bridge + Dockerfile/compose + rebuild container"
}

case "$MODE" in
    --help|-h)
        usage
        exit 0
        ;;
    --prod|prod|--prod-reset)
        MODE="prod-reset"
        ;;
    --prod-restart)
        MODE="prod-restart"
        ;;
    --prod-update-env)
        MODE="prod-update-env"
        ;;
    --prod-health)
        MODE="prod-health"
        ;;
    --prod-fix-containerconfig)
        MODE="prod-fix-containerconfig"
        ;;
    --prod-all)
        MODE="prod-all"
        ;;
    --prod-sync-bridge)
        MODE="prod-sync-bridge"
        ;;
    --prod-rebuild-bridge)
        MODE="prod-rebuild-bridge"
        ;;
    local|"")
        MODE="local"
        ;;
    *)
        echo "Unknown mode: $MODE"
        usage
        exit 1
        ;;
esac

resolve_prod_target() {
    PROJECT_ID="${GCP_PROJECT_ID:-wheel-strat}"
    INSTANCE_ID="${IBKR_BRIDGE_INSTANCE_ID:-1568556415025546399}"
    INSTANCE_NAME="${IBKR_BRIDGE_INSTANCE_NAME:-ibkr-bridge}"
    EXTERNAL_IP="${IBKR_BRIDGE_EXTERNAL_IP:-35.224.187.242}"
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

if [ "$MODE" != "local" ]; then
    if ! command -v gcloud >/dev/null 2>&1; then
        echo "gcloud CLI is required for prod actions."
        exit 1
    fi

    resolve_prod_target

    case "$MODE" in
        prod-reset)
            echo "Rebooting prod IBKR bridge instance ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute instances reset "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID"
            echo "Reboot requested. Check health: curl -sS http://${EXTERNAL_IP}:5050/health"
            ;;
        prod-restart)
            echo "Restarting docker-compose on ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
                --command="cd ~/wheel-strat/infrastructure && sudo docker-compose down && sudo docker-compose up -d --build"
            ;;
        prod-update-env)
            if [ ! -f "$ENV_FILE" ]; then
                echo "Missing ${ENV_FILE}. Copy infrastructure/.env.template and fill values."
                exit 1
            fi
            echo "Uploading ${ENV_FILE} to ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$ENV_FILE" \
                "${INSTANCE_NAME}:~/wheel-strat/infrastructure/.env"
            if [ -f "${SCRIPT_DIR}/jts.ini" ]; then
                echo "Uploading ${SCRIPT_DIR}/jts.ini to ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
                gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "${SCRIPT_DIR}/jts.ini" \
                    "${INSTANCE_NAME}:~/wheel-strat/infrastructure/jts.ini"
            fi
            ;;
        prod-health)
            echo "Checking ping: http://${EXTERNAL_IP}:5050/ping"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/ping"
            echo ""
            echo "Checking health: http://${EXTERNAL_IP}:5050/health?connect=false"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/health?connect=false"
            ;;
        prod-all)
            if [ ! -f "$ENV_FILE" ]; then
                echo "Missing ${ENV_FILE}. Copy infrastructure/.env.template and fill values."
                exit 1
            fi
            echo "Uploading ${ENV_FILE} to ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$ENV_FILE" \
                "${INSTANCE_NAME}:~/wheel-strat/infrastructure/.env"
            if [ -f "${SCRIPT_DIR}/jts.ini" ]; then
                echo "Uploading ${SCRIPT_DIR}/jts.ini to ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
                gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "${SCRIPT_DIR}/jts.ini" \
                    "${INSTANCE_NAME}:~/wheel-strat/infrastructure/jts.ini"
            fi
            echo "Restarting docker-compose on ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
                --command="cd ~/wheel-strat/infrastructure && sudo docker-compose down && sudo docker-compose up -d --build"
            echo "Checking ping: http://${EXTERNAL_IP}:5050/ping"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/ping"
            echo ""
            echo "Checking health: http://${EXTERNAL_IP}:5050/health?connect=false"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/health?connect=false"
            ;;
        prod-fix-containerconfig)
            if [ ! -f "${SCRIPT_DIR}/fix_containerconfig.sh" ]; then
                echo "Missing ${SCRIPT_DIR}/fix_containerconfig.sh"
                exit 1
            fi
            FIX_FLAGS=(--prod)
            if [ "${FIX_CONTAINERCONFIG_REMOVE_IMAGE:-}" = "1" ]; then
                FIX_FLAGS+=(--remove-image)
            fi
            "${SCRIPT_DIR}/fix_containerconfig.sh" "${FIX_FLAGS[@]}"
            ;;
        prod-sync-bridge)
            BRIDGE_SRC="${SCRIPT_DIR}/../scripts/bridge/ibkr_bridge.py"
            if [ ! -f "$BRIDGE_SRC" ]; then
                echo "Missing ${BRIDGE_SRC}"
                exit 1
            fi
            echo "Uploading ibkr_bridge.py to ${INSTANCE_NAME} (${PROJECT_ID}, ${ZONE})..."
            gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$BRIDGE_SRC" \
                "${INSTANCE_NAME}:~/wheel-strat/scripts/bridge/ibkr_bridge.py"
            echo "Done. Run --prod-rebuild-bridge to apply changes."
            ;;
        prod-rebuild-bridge)
            BRIDGE_SRC="${SCRIPT_DIR}/../scripts/bridge/ibkr_bridge.py"
            if [ ! -f "$BRIDGE_SRC" ]; then
                echo "Missing ${BRIDGE_SRC}"
                exit 1
            fi
            echo "Uploading ibkr_bridge.py to ${INSTANCE_NAME}..."
            gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$BRIDGE_SRC" \
                "${INSTANCE_NAME}:~/wheel-strat/scripts/bridge/ibkr_bridge.py"
            DOCKERFILE_SRC="${SCRIPT_DIR}/Dockerfile"
            if [ -f "$DOCKERFILE_SRC" ]; then
                echo "Uploading Dockerfile to ${INSTANCE_NAME}..."
                gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$DOCKERFILE_SRC" \
                    "${INSTANCE_NAME}:~/wheel-strat/infrastructure/Dockerfile"
            fi
            COMPOSE_SRC="${SCRIPT_DIR}/docker-compose.yml"
            if [ -f "$COMPOSE_SRC" ]; then
                echo "Uploading docker-compose.yml to ${INSTANCE_NAME}..."
                gcloud compute scp --project="$PROJECT_ID" --zone="$ZONE" "$COMPOSE_SRC" \
                    "${INSTANCE_NAME}:~/wheel-strat/infrastructure/docker-compose.yml"
            fi
            echo "Removing and rebuilding bridge-api container (avoids ContainerConfig bug)..."
            gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
                --command="cd ~/wheel-strat/infrastructure && sudo docker-compose rm -sf bridge-api && sudo docker-compose up -d --build bridge-api"
            echo ""
            sleep 3
            echo "Checking ping: http://${EXTERNAL_IP}:5050/ping"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/ping" || true
            echo ""
            echo "Checking health: http://${EXTERNAL_IP}:5050/health?connect=false"
            curl -sS --max-time 8 "http://${EXTERNAL_IP}:5050/health?connect=false" || true
            ;;
    esac
    exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Missing ${ENV_FILE}. Copy infrastructure/.env.template and fill values."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

TRADING_MODE="${TRADING_MODE:-paper}"
IB_HOST="${IB_HOST:-ib-gateway}"
IB_CLIENT_ID="${IB_CLIENT_ID:-1}"

if [ -z "${IB_PORT:-}" ]; then
    IB_PORT=4004
fi

if [ "$IB_PORT" != "4004" ]; then
    echo "Note: IB_PORT=${IB_PORT} (direct gateway). For the dockerized bridge, 4004 is recommended."
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    COMPOSE_LABEL="docker compose"
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    COMPOSE_LABEL="docker-compose"
else
    echo "Docker Compose not available. Install the compose plugin or docker-compose and retry."
    exit 1
fi

if docker info >/dev/null 2>&1; then
    SUDO=()
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    SUDO=(sudo)
else
    echo "Docker daemon is not running. Start Docker Desktop (or the Docker service) and retry."
    exit 1
fi

if [ -z "${IBKR_BRIDGE_API_KEY:-}" ] && [ -n "${BRIDGE_API_KEY:-}" ]; then
    IBKR_BRIDGE_API_KEY="$BRIDGE_API_KEY"
fi

export TRADING_MODE IB_HOST IB_PORT IB_CLIENT_ID IBKR_BRIDGE_API_KEY BRIDGE_API_KEY

echo "Using ${COMPOSE_LABEL}."
if ! "${SUDO[@]}" "${COMPOSE_CMD[@]}" -f "${SCRIPT_DIR}/docker-compose.yml" config >/dev/null 2>&1; then
    echo "Docker Compose could not read ${SCRIPT_DIR}/docker-compose.yml."
    echo "Verify Docker is running and the compose command supports the -f flag."
    exit 1
fi

echo "Restarting IBKR bridge stack (mode=${TRADING_MODE}, host=${IB_HOST}, port=${IB_PORT})..."
"${SUDO[@]}" "${COMPOSE_CMD[@]}" -f "${SCRIPT_DIR}/docker-compose.yml" down
"${SUDO[@]}" "${COMPOSE_CMD[@]}" -f "${SCRIPT_DIR}/docker-compose.yml" pull ib-gateway
"${SUDO[@]}" "${COMPOSE_CMD[@]}" -f "${SCRIPT_DIR}/docker-compose.yml" up -d --build bridge-api ib-gateway caddy

echo "Waiting for bridge ping..."
sleep 5
curl -sS --max-time 8 "https://35-224-187-242.sslip.io/ping" || true
echo ""
echo "Checking bridge health..."
curl -sS --max-time 8 "https://35-224-187-242.sslip.io/health?connect=false" || true
