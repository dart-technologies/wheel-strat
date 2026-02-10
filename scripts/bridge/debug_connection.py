import asyncio
import os
import time
from ib_insync import IB, Stock, util

async def debug_ib_connection():
    # Use the bridge-api's target host/port
    # If running from host, use 127.0.0.1:4004
    # If running inside bridge container, use ib-gateway:4004
    host = os.getenv('IB_HOST', '127.0.0.1')
    port = int(os.getenv('IB_PORT', '4004'))
    client_id = 888  # Unique test ID
    
    ib = IB()
    print(f"DEBUG: Attempting to connect to {host}:{port}...")
    
    try:
        # 1. Test Socket Connection
        start_connect = time.time()
        await ib.connectAsync(host, port, clientId=client_id, timeout=10)
        print(f"DEBUG: TCP Connection established in {time.time() - start_connect:.2f}s")
        print(f"DEBUG: ib.isConnected() = {ib.isConnected()}")
        
        # 2. Test Message Exchange (The real test)
        # This checks if we can actually get a response from the Gateway (Port 4002)
        # through the socat proxy (Port 4004)
        print("DEBUG: Testing message exchange (reqCurrentTime)...")
        try:
            current_time = await asyncio.wait_for(ib.reqCurrentTimeAsync(), timeout=5)
            print(f"DEBUG: SUCCESS! Received IB server time: {current_time}")
        except asyncio.TimeoutError:
            print("DEBUG: FAILURE! reqCurrentTime timed out. Socket is open but Gateway is not responding.")
            print("DEBUG: This confirms the 'zombied' proxy issue.")
            return False
            
        # 3. Test Market Data Path
        print("DEBUG: Testing market data path (MSFT)...")
        stock = Stock('MSFT', 'SMART', 'USD')
        await ib.qualifyContractsAsync(stock)
        ticker = ib.reqMktData(stock, '', False, False)
        
        # Wait up to 5s for any price (Last, Bid, or Ask)
        found_data = False
        for i in range(10):
            await asyncio.sleep(0.5)
            if ticker.last == ticker.last or ticker.bid == ticker.bid or ticker.close == ticker.close:
                print(f"DEBUG: SUCCESS! Received market data for MSFT: Last={ticker.last}, Bid={ticker.bid}, Close={ticker.close}")
                found_data = True
                break
        
        if not found_data:
            print("DEBUG: WARNING! Connection is active but no market data received. Check subscriptions.")
            
        return True
        
    except Exception as e:
        print(f"DEBUG: Connection error: {e}")
        return False
    finally:
        if ib.isConnected():
            ib.disconnect()
            print("DEBUG: Disconnected.")

if __name__ == '__main__':
    # Ensure we use the correct event loop
    util.patchAsyncio()
    success = asyncio.run(debug_ib_connection())
    if success:
        print("\nSUMMARY: End-to-end connectivity is WORKING.")
    else:
        print("\nSUMMARY: End-to-end connectivity is BROKEN.")