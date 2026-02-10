import requests
import json
import time

BRIDGE_URL = "http://localhost:5050"
SYMBOLS = ["NVDA", "META", "TSLA"]
TARGET_DATE = "20250718 00:00:00" # End date, so it captures July 17

def fetch_price(symbol):
    try:
        response = requests.post(
            f"{BRIDGE_URL}/historical",
            json={
                "symbol": symbol,
                "endDateTime": TARGET_DATE,
                "duration": "1 D",
                "barSize": "1 day"
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data['bars']:
                close_price = data['bars'][0]['close']
                print(f"{symbol}: ${close_price}")
                return close_price
            else:
                print(f"{symbol}: No bars found")
        else:
            print(f"{symbol}: Error {response.status_code} - {response.text}")
    except Exception as e:
        print(f"{symbol}: Exception {e}")
    return None

def main():
    print("Waiting for bridge...")
    # Wait a bit for bridge to start if run immediately after
    for i in range(10):
        try:
            requests.get(f"{BRIDGE_URL}/health")
            break
        except:
            time.sleep(1)
            
    print(f"Fetching prices for July 17, 2025 (Date: {TARGET_DATE})...")
    for symbol in SYMBOLS:
        fetch_price(symbol)

if __name__ == "__main__":
    main()
