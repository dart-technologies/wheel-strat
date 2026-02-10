FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Explicitly listing contents of requirements.txt here to avoid copy if possible, 
# but copying is safer for sync
COPY scripts/bridge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the bridge script
COPY scripts/bridge/ibkr_bridge.py .

# Expose port
EXPOSE 5050

# Environment variables (defaults)
ENV IB_HOST=ib-gateway
ENV IB_PORT=4004
ENV IB_CLIENT_ID=1
ENV IB_TRADING_MODE=paper
ENV PYTHONUNBUFFERED=1

# Run the server
CMD ["python", "ibkr_bridge.py"]
