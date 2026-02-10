#!/bin/bash

# Configuration
PROJECT_ID="wheel-strat"
REGION="us-central1"
ZONE="us-central1-a"
INSTANCE_NAME="ibkr-bridge"
MACHINE_TYPE="e2-micro"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Deployment to GCP ($PROJECT_ID)...${NC}"

# 1. Create VM if it doesn't exist
if ! gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
    echo "Creating Instance $INSTANCE_NAME..."
    gcloud compute instances create $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --zone=$ZONE \
        --machine-type=$MACHINE_TYPE \
        --image-family=$IMAGE_FAMILY \
        --image-project=$IMAGE_PROJECT \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --tags=http-server,https-server
else
    echo "Instance $INSTANCE_NAME already exists."
fi

# 2. Open Firewall Ports
if ! gcloud compute firewall-rules describe allow-ibkr-bridge &>/dev/null; then
    echo "Creating Firewall Rule for Ports 80, 443, 5050, 4004, 5900..."
    gcloud compute firewall-rules create allow-ibkr-bridge \
        --allow tcp:80,tcp:443,tcp:5050,tcp:4004,tcp:5900 \
        --target-tags=http-server \
        --description="Allow traffic to HTTP, HTTPS, IBKR Bridge API, Gateway (socat), and VNC"
else
    # Update existing rule to include new ports if needed
    echo "Updating Firewall Rule..."
    echo "Updating Firewall Rule..."
    gcloud compute firewall-rules update allow-ibkr-bridge --allow tcp:80,tcp:443,tcp:5050,tcp:4004,tcp:5900
fi

# 3. Prepare Remote Directory
echo "Preparing remote directory..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="mkdir -p ~/wheel-strat/infrastructure ~/wheel-strat/scripts"

# 4. Copy Files
echo "Copying files..."
# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

gcloud compute scp --zone=$ZONE "$SCRIPT_DIR/Caddyfile" $INSTANCE_NAME:~/wheel-strat/infrastructure/
gcloud compute scp --zone=$ZONE "$SCRIPT_DIR/docker-compose.yml" $INSTANCE_NAME:~/wheel-strat/infrastructure/
gcloud compute scp --zone=$ZONE "$SCRIPT_DIR/Dockerfile" $INSTANCE_NAME:~/wheel-strat/infrastructure/
gcloud compute scp --zone=$ZONE "$SCRIPT_DIR/jts.ini" $INSTANCE_NAME:~/wheel-strat/infrastructure/
gcloud compute scp --zone=$ZONE "$SCRIPT_DIR/.env" $INSTANCE_NAME:~/wheel-strat/infrastructure/
gcloud compute scp --zone=$ZONE "$PROJECT_ROOT/scripts/bridge/ibkr_bridge.py" $INSTANCE_NAME:~/wheel-strat/scripts/bridge/
gcloud compute scp --zone=$ZONE "$PROJECT_ROOT/scripts/requirements.txt" $INSTANCE_NAME:~/wheel-strat/scripts/

# 5. Provision and Start
echo "Provisioning and Starting Services..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo 'Installing Docker...'
        sudo apt-get update
        sudo apt-get install -y docker.io
        sudo usermod -aG docker \$USER
    fi

    # Install/upgrade docker-compose v2 (fixes ContainerConfig bug in v1.29.2)
    if ! docker-compose version 2>/dev/null | grep -q 'v2'; then
        echo 'Installing docker-compose v2...'
        sudo curl -L 'https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64' -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        sudo rm -f /usr/bin/docker-compose 2>/dev/null || true
    fi
    echo \"docker-compose version: \$(docker-compose --version)\"

    # Start Services
    cd ~/wheel-strat/infrastructure
    # We might need to log out/in for group changes to make effect, or use sudo for docker-compose
    echo 'Starting Docker Compose...'
    sudo docker-compose down
    sudo docker-compose up --build -d
"

echo -e "${GREEN}✅ Deployment Complete!${NC}"
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo -e "Make requests to: https://35-224-187-242.sslip.io"
echo -e "Don't forget to include header: X-API-KEY: <your-key>"
