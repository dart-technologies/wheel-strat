#!/bin/bash
set -e

# Wheel Strat OCI Deployment Script
# Targets: Oracle Cloud Always Free (ARM Ampere A1)

# Variables
DOCKER_COMPOSE_FILE="infrastructure/docker-compose.oci.yml"
ENV_FILE="infrastructure/.env"

echo "🚀 Starting Wheel Strat OCI Deployment..."

# 1. Update system and install dependencies
echo "📦 Updating system dependencies..."
sudo apt-get update && sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    build-essential

# 2. Install Docker (if not present)
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Wait for group changes to take effect or logout/login. Proceeding with sudo for now."
fi

# 3. Setup Firewall (OCI Ubuntu default is iptables-persistent)
echo "🛡️ Configuring Firewall for OCI..."
# Clear standard OCI rejects
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5050 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 6080 -j ACCEPT
sudo netfilter-persistent save

# 4. Pull/Build Containers
echo "🏗️ Building and pulling containers..."
sudo docker compose -f $DOCKER_COMPOSE_FILE --env-file $ENV_FILE pull
sudo docker compose -f $DOCKER_COMPOSE_FILE --env-file $ENV_FILE build

# 5. Launch
echo "🟢 Launching Wheel Strat Stack..."
sudo docker compose -f $DOCKER_COMPOSE_FILE --env-file $ENV_FILE up -d

echo "✅ Deployment complete!"
echo "📍 Access Bridge API at: https://$CADDY_HOST"
echo "🖥️ Access IB Gateway VNC at: http://<vm-ip>:6080/vnc.html"

# Health Check Loop
echo "⏳ Waiting for services to stabilize..."
sleep 10
sudo docker compose -f $DOCKER_COMPOSE_FILE ps
