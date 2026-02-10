# Infrastructure Deployment

This directory contains the Docker and Google Cloud Platform (GCP) configuration for deploying the "always-on" IBKR Bridge.

📱 **TestFlight**: https://testflight.apple.com/join/vK1pNwbs

## Prerequisites

1.  **Google Cloud SDK**: Ensure `gcloud` is installed and authenticated (`gcloud auth login`).
2.  **IBKR Account**: You need your username and password.

## Setup

1.  **Create .env file**:
    Copy the template and fill in your credentials.
    ```bash
    cp .env.template .env
    # Edit .env with your actual IBKR credentials and a secure API Key
    nano .env
    ```

2.  **Optional: Pre-seed IB Gateway API settings**:
    Edit `jts.ini` to persist API settings (socket port, read-only, trusted IPs).
    The default file clears `TrustedIPs` so non-local clients can connect.
    If you change settings in the UI, you can pull them back with:
    ```bash
    ./pull_jts_ini.sh
    ```
    
3.  **Optional: Enable event-driven execution sync**:
    Set `IBKR_EXECUTION_WEBHOOK_URL` to the Functions endpoint that ingests executions.

## Deployment

Run the deployment script to provision the VM and deploy the containers.

```bash
./deploy_gcp.sh
```

This script will:
1.  Create a free-tier eligible `e2-micro` instance in `us-central1`.
2.  Open port `5050`.
3.  Install Docker on the VM.
4.  Copy your code and `.env` file.
5.  Start the services.

## Output

The script will output the **External IP** of your new bridge.
Example: `http://34.123.45.67:5050`

## JVM Tuning (Memory Optimization)

The `ib-gateway` container runs IB Gateway (Java) and requires careful memory tuning on the e2-micro (1GB RAM).

**Current Configuration** (`docker-compose.yml`):
- `JAVA_HEAP_SIZE=256` — Reduced heap to leave room for Bridge API, Caddy, and OS
- `TWS_EXTRA_ARGS` — Additional JVM flags for memory efficiency:
  - `-XX:+UseSerialGC` — Lower memory overhead than G1GC
  - `-XX:MaxMetaspaceSize=128m` — Caps class metadata memory
  - `-XX:+AlwaysPreTouch` — Pre-allocates heap for predictability
  - `-XX:+ExitOnOutOfMemoryError` — Crashes cleanly so Docker can restart

**If OOM issues persist**, consider upgrading to **e2-small** (2GB RAM, ~$6/mo more):
```bash
# In deploy_gcp.sh, change:
MACHINE_TYPE="e2-small"
```

## Usage in App

Update your `app.config.js` or `firebase functions config` to use this new URL.
Don't forget to add the `X-API-KEY` header to your requests!
