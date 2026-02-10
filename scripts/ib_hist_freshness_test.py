import asyncio
import os
import datetime
from ib_insync import *
import time

# Configuration
HOST = os.getenv('IB_HOST', '127.0.0.1')
PORT = int(os.getenv('IB_PORT', '4002')) # Default to 4002 (Live/Bridge)
CLIENT_ID = 998 # Unique ID for this test

async def run_test():
    ib = IB()
    print(f"=== Connecting to {HOST}:{PORT} ===")
    try:
        await ib.connectAsync(HOST, PORT, clientId=CLIENT_ID)
    except Exception as e:
        print(f"Connection Failed: {e}")
        return

    # 1. Define Contract (AMZN Put, same as before)
    # Using a slightly dynamic expiry selection or hardcoding known valid one
    stock = Stock('AMZN', 'SMART', 'USD')
    await ib.qualifyContractsAsync(stock)
    
    print(f"Fetching chains for {stock.symbol}...")
    chains = await ib.reqSecDefOptParamsAsync(stock.symbol, '', stock.secType, stock.conId)
    
    if not chains:
        print("No option chains found.")
        return

    # Pick a near-term expiration and ATM strike
    chain = chains[0]
    expirations = sorted(chain.expirations)
    strikes = sorted(chain.strikes)
    
    # 2 weeks out roughly
    target_exp = expirations[1] if len(expirations) > 1 else expirations[0]
    
    # Find strike near last price of stock
    # We don't have stock price handy easily without market data subs, so let's just pick a middle strike
    # OR, quickly request delayed stock data
    stock_ticker = ib.reqMktData(stock, '', False, False)
    await asyncio.sleep(2) # Wait for delayed tick
    
    ref_price = stock_ticker.last if (stock_ticker.last and stock_ticker.last > 0) else 230.0 # Fallback
    print(f"Ref Price: {ref_price}")
    
    target_strike = min(strikes, key=lambda x: abs(x - ref_price))
    
    print(f"Targeting: AMZN {target_exp} {target_strike} Put")
    
    option = Option('AMZN', target_exp, target_strike, 'P', 'SMART')
    await ib.qualifyContractsAsync(option)
    print(f"Contract: {option.localSymbol}")

    # 2. Request 1-min Historical Data
    print("\n=== Requesting 1-min bars (Last 30 mins) ===")
    
    # endDateTime='' means "now"
    bars = await ib.reqHistoricalDataAsync(
        option,
        endDateTime='',
        durationStr='1800 S', # 30 mins
        barSizeSetting='1 min',
        whatToShow='MIDPOINT', # Midpoint is best for fetching even if illiquid
        useRTH=True,
        formatDate=1 # 1 = string "yyyymmdd  hh:mm:ss"
    )
    
    print(f"Received {len(bars)} bars.")
    
    if bars:
        last_bar = bars[-1]
        print(f"Last Bar Time: {last_bar.date}")
        print(f"Last Bar Close: {last_bar.close}")
        
        # Calculate Lag
        # Bar time is start of the minute? or end? IBKR bars usually labeled by start time.
        # Check current time
        now = datetime.datetime.now()
        # Parse bar date if it's a string, ib_insync returns datetime objects usually though
        
        # ib_insync returns datetime with tz info usually
        print(f"Current Local Time: {now}")
        
        # Approximate diff
        # Note: If bar is 10:00:00, that covers 10:00-10:01.
        
    else:
        print("No bars received.")

    ib.disconnect()

if __name__ == '__main__':
    asyncio.run(run_test())
