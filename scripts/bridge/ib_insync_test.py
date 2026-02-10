import asyncio
import os
from ib_insync import *
import datetime

# Configuration
HOST = os.getenv('IB_HOST', '127.0.0.1')
PORT = int(os.getenv('IB_PORT', '4004'))
CLIENT_ID = 999  # Temporary ID for testing

async def run_test():
    ib = IB()
    print(f"=== 1. Connecting to IB Gateway ({HOST}:{PORT}) ===")
    try:
        await ib.connectAsync(HOST, PORT, clientId=CLIENT_ID)
        print("SUCCESS: Connected to IB Gateway.")
    except Exception as e:
        print(f"ERROR: Could not connect to IB Gateway: {e}")
        return

    print("\n=== 2. Requesting Market Data (Underlying: AMZN) ===")
    # Define contract
    stock = Stock('AMZN', 'SMART', 'USD')
    # Request market data
    ticker = ib.reqMktData(stock, '', False, False)
    
    print("Waiting for data...")
    count = 0
    while ticker.last != ticker.last and count < 10:  # Wait for price
        await asyncio.sleep(0.5)
        count += 1
        
    print(f"AMZN Market Data: Last={ticker.last} Bid={ticker.bid} Ask={ticker.ask}")
    if ticker.last or ticker.bid or ticker.ask:
        print("SUCCESS: Received Market Data.")
    else:
        print("WARNING: No live data received (Market closed? Subscription missing?)")

    print("\n=== 3. Searching for Option Chain (AMZN) ===")
    # Get expiration dates
    chains = await ib.reqSecDefOptParamsAsync(stock.symbol, '', stock.secType, stock.conId)
    if not chains:
        # If we can't find chains by name, we might need the conId explicitly first
        # Let's qualify the stock first
        await ib.qualifyContractsAsync(stock)
        chains = await ib.reqSecDefOptParamsAsync(stock.symbol, '', stock.secType, stock.conId)

    if chains:
        chain = chains[0]
        expirations = sorted(exp for exp in chain.expirations)
        strikes = sorted(strike for strike in chain.strikes)
        print(f"Found {len(expirations)} expirations and {len(strikes)} strikes.")
        print(f"Example Expirations: {expirations[:3]}")
        
        # Pick a target option
        target_exp = expirations[3] if len(expirations) > 3 else expirations[0]
        # Find a strike near current price (or arbitrary 200)
        target_strike = next((s for s in strikes if s >= 200), strikes[0])
        
        print(f"Selecting Target: AMZN {target_exp} {target_strike} Put")
        
        option = Option('AMZN', target_exp, target_strike, 'P', 'SMART')
        await ib.qualifyContractsAsync(option)
        print(f"Resolved Option Contract: {option.localSymbol} (ConId: {option.conId})")
        
        print("\n=== 4. Fetching Option Greeks (Snapshot) ===")
        # Request snapshot for greeks (Generic Tick 100=Option Volume, 101=Open Interest, 104=Hist Vol, 106=Implied Vol)
        opt_ticker = ib.reqMktData(option, '100,101,104,106', True, False)
        
        # Wait a bit
        await asyncio.sleep(2)
        
        print(f"Option Greeks: Delta={opt_ticker.modelGreeks.delta if opt_ticker.modelGreeks else 'N/A'}")
        print(f"Implied Vol: {opt_ticker.modelGreeks.impliedVol if opt_ticker.modelGreeks else 'N/A'}")
        print(f"Bid/Ask: {opt_ticker.bid}/{opt_ticker.ask}")
        
        print("\n=== 5. Fetching Historical Option Data (Backtesting Check) ===")
        # Request 1 week of daily bars
        end_time = ''
        print("Requesting 5 days of 1-hour bars...")
        try:
            bars = await ib.reqHistoricalDataAsync(
                option, 
                endDateTime=end_time, 
                durationStr='2 D', 
                barSizeSetting='15 mins', 
                whatToShow='MIDPOINT', 
                useRTH=True
            )
            print(f"Received {len(bars)} bars.")
            if bars:
                print(f"First Bar: {bars[0]}")
                print(f"Last Bar: {bars[-1]}")
                print("SUCCESS: Historical Data available for Options.")
            else:
                print("WARNING: No bars returned.")
        except Exception as e:
            print(f"ERROR Fetching Historical Data: {e}")

    else:
        print("ERROR: No Option Chains found.")

    ib.disconnect()
    print("\n=== Test Complete ===")

if __name__ == '__main__':
    asyncio.run(run_test())
