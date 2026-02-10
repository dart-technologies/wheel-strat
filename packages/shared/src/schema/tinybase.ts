export const SCHEMAS = {
    portfolio: {
        cash: { type: 'number', default: 1000000 },
        buyingPower: { type: 'number', default: 1000000 },
        netLiq: { type: 'number', default: 1000000 },
        dailyPnl: { type: 'number', default: 0 },
        dailyPnlPct: { type: 'number', default: 0 },
        realizedPnL: { type: 'number' },
        unrealizedPnL: { type: 'number' },
        excessLiquidity: { type: 'number' },
        availableFunds: { type: 'number' },
        portfolioDelta: { type: 'number' },
        portfolioTheta: { type: 'number' },
        betaWeightedDelta: { type: 'number' },
        bpUsagePct: { type: 'number' },
        vix: { type: 'number' },
    },
    positions: {
        symbol: { type: 'string' },
        quantity: { type: 'number' },
        averageCost: { type: 'number' },
        currentPrice: { type: 'number' },
        closePrice: { type: 'number' },
        costBasis: { type: 'number' },
        marketValue: { type: 'number' },
        dailyPnl: { type: 'number' },
        dailyPnlPct: { type: 'number' },
        ivRank: { type: 'number' },
        rsi: { type: 'number' },
        beta: { type: 'number' },
        delta: { type: 'number' },
        theta: { type: 'number' },
        gamma: { type: 'number' },
        vega: { type: 'number' },
        companyName: { type: 'string' },
        ccYield: { type: 'number' },
        ccPremium: { type: 'number' },
        ccPremiumSource: { type: 'string' },
        ccStrike: { type: 'number' },
        ccExpiration: { type: 'string' },
        ccWinProb: { type: 'number' },
        ccDelta: { type: 'number' },
        ccGamma: { type: 'number' },
        ccTheta: { type: 'number' },
        ccVega: { type: 'number' },
        cspYield: { type: 'number' },
        cspPremium: { type: 'number' },
        cspPremiumSource: { type: 'string' },
        cspStrike: { type: 'number' },
        cspExpiration: { type: 'string' },
        cspWinProb: { type: 'number' },
        cspDelta: { type: 'number' },
        cspGamma: { type: 'number' },
        cspTheta: { type: 'number' },
        cspVega: { type: 'number' },
    },
    optionPositions: {
        symbol: { type: 'string' },
        quantity: { type: 'number' },
        averageCost: { type: 'number' },
        currentPrice: { type: 'number' },
        closePrice: { type: 'number' },
        costBasis: { type: 'number' },
        marketValue: { type: 'number' },
        dailyPnl: { type: 'number' },
        dailyPnlPct: { type: 'number' },
        right: { type: 'string' },
        strike: { type: 'number' },
        expiration: { type: 'string' },
        multiplier: { type: 'number' },
        secType: { type: 'string' },
        localSymbol: { type: 'string' },
        conId: { type: 'number' },
        companyName: { type: 'string' },
    },
    trades: {
        id: { type: 'string' },
        symbol: { type: 'string' },
        type: { type: 'string' },
        quantity: { type: 'number' },
        price: { type: 'number' },
        date: { type: 'string' },
        total: { type: 'number' },
        commission: { type: 'number' },
        entryIvRank: { type: 'number' },
        entryVix: { type: 'number' },
        entryDelta: { type: 'number' },
        entryTheta: { type: 'number' },
        entryRsi: { type: 'number' },
        entryBeta: { type: 'number' },
    },
    orders: {
        id: { type: 'string' },
        symbol: { type: 'string' },
        type: { type: 'string' },
        quantity: { type: 'number' },
        price: { type: 'number' },
        date: { type: 'string' },
        total: { type: 'number' },
        status: { type: 'string' },
        orderStatus: { type: 'string' },
        updatedAt: { type: 'string' },
        initMarginChange: { type: 'number' },
    },
    watchList: {
        symbol: { type: 'string' },
        name: { type: 'string' },
    },
    opportunities: {
        symbol: { type: 'string' },
        description: { type: 'string' },
        strategy: { type: 'string' },
        strike: { type: 'number' },
        expiration: { type: 'string' },
        premium: { type: 'number' },
        winProb: { type: 'number' },
        ivRank: { type: 'number' },
        currentPrice: { type: 'number' },
        delta: { type: 'number' },
        gamma: { type: 'number' },
        theta: { type: 'number' },
        vega: { type: 'number' },
        impliedVol: { type: 'number' },
        annualizedYield: { type: 'number' },
        priority: { type: 'number' },
        reasoning: { type: 'string' },
        analysis: { type: 'string' }, // JSON string
        context: { type: 'string' },  // JSON string
        createdAt: { type: 'string' },
    },
    marketData: {
        symbol: { type: 'string' },
        price: { type: 'number' },
        closePrice: { type: 'number' },
        ivRank: { type: 'number' },
        rsi: { type: 'number' },
        beta: { type: 'number' },
        updatedAt: { type: 'string' },
    },
    appSettings: {
        onboardingSeen: { type: 'boolean', default: false },
        riskLevel: { type: 'string', default: 'Moderate' },
        guestMode: { type: 'boolean', default: false },
        traderLevel: { type: 'string', default: 'Intermediate' },
        dteWindow: { type: 'string', default: 'three_weeks' },
        analysisRiskLevel: { type: 'string' },
        analysisTraderLevel: { type: 'string' },
        analysisDteWindow: { type: 'string' },
        analysisUpdatedAt: { type: 'string' },
        opportunitySynopsis: { type: 'string' },
    },
    syncMetadata: {
        lastMarketRefresh: { type: 'string' },
        lastDailyPnl: { type: 'number' },
        lastDailyPnlPct: { type: 'number' },
        lastUnrealizedPnl: { type: 'number' },
        lastUnrealizedPnlPct: { type: 'number' },
        lastStrategiesScan: { type: 'string' },
        lastTradesSync: { type: 'string' },
        lastLeaderboardUpdate: { type: 'string' },
        lastEquitySnapshot: { type: 'string' },
        lastPortfolioSync: { type: 'string' },
        lastPositionsSync: { type: 'string' },
        lastCalendarSync: { type: 'string' },
        lastCorporateActionsSync: { type: 'string' },
        lastCommunitySync: { type: 'string' },
        lastPredictionSync: { type: 'string' },
    },
    equityCurve: {
        date: { type: 'string' },
        netLiq: { type: 'number' },
        createdAt: { type: 'string' },
    },
    predictionHistory: {
        symbol: { type: 'string' },
        strategy: { type: 'string' },
        strike: { type: 'number' },
        expiration: { type: 'string' },
        verdict: { type: 'string' },
        target: { type: 'number' },
        outcome: { type: 'string' },
        ivRank: { type: 'number' },
        rsi: { type: 'number' },
        volatility: { type: 'number' },
        evaluatedAt: { type: 'string' },
        createdAt: { type: 'string' },
        success: { type: 'boolean' },
    },
    corporateActions: {
        symbol: { type: 'string' },
        type: { type: 'string' },
        ratio: { type: 'number' },
        exDate: { type: 'string' },
        effectiveDate: { type: 'string' },
        source: { type: 'string' },
        processedAt: { type: 'string' },
    },
    marketCalendar: {
        date: { type: 'string' },
        market: { type: 'string' },
        isOpen: { type: 'boolean' },
        holiday: { type: 'string' },
        event: { type: 'string' },
        earlyClose: { type: 'boolean' },
        impact: { type: 'string' },
        symbols: { type: 'string' },
        updatedAt: { type: 'string' },
        source: { type: 'string' },
    },
    marketCache: {
        key: { type: 'string' },
        tier: { type: 'string' },
        payload: { type: 'string' },
        updatedAt: { type: 'string' },
        expiresAt: { type: 'string' },
        source: { type: 'string' },
        symbol: { type: 'string' },
        category: { type: 'string' },
    }
};

type SeedRow = Record<string, string | number | boolean | null>;
type SeedTable = Record<string, SeedRow>;

export const SEED_DATA: {
    portfolio: SeedTable;
    positions: SeedTable;
    optionPositions: SeedTable;
    watchList: SeedTable;
    trades: SeedTable;
    orders: SeedTable;
    opportunities: SeedTable;
    marketData: SeedTable;
    appSettings: SeedTable;
    syncMetadata: SeedTable;
    equityCurve: SeedTable;
    predictionHistory: SeedTable;
    corporateActions: SeedTable;
    marketCalendar: SeedTable;
    marketCache: SeedTable;
} = {
    portfolio: {
        main: {
            cash: 1000000,
            buyingPower: 1000000,
            netLiq: 1000242,
        }
    },
    positions: {
        'AAPL': { symbol: 'AAPL', quantity: 100, averageCost: 210.02, currentPrice: 255.53 }, // Bought July 17, 2025
        'MSFT': { symbol: 'MSFT', quantity: 100, averageCost: 511.70, currentPrice: 459.86 }, // Bought July 17, 2025
        'GOOGL': { symbol: 'GOOGL', quantity: 100, averageCost: 183.58, currentPrice: 333.00 }, // Bought July 17, 2025
        'AMZN': { symbol: 'AMZN', quantity: 100, averageCost: 223.88, currentPrice: 239.12 }, // Bought July 17, 2025
        'NVDA': { symbol: 'NVDA', quantity: 100, averageCost: 173.00, currentPrice: 186.51 }, // Bought July 17, 2025
        'META': { symbol: 'META', quantity: 100, averageCost: 701.41, currentPrice: 620.54 }, // Bought July 17, 2025
        'TSLA': { symbol: 'TSLA', quantity: 100, averageCost: 319.41, currentPrice: 437.86 }, // Bought July 17, 2025
    },
    optionPositions: {},
    trades: {
        't1': { id: 't1', symbol: 'NVDA', type: 'BUY', quantity: 100, price: 173.00, date: '2025-07-17', total: 17300 },
        't2': { id: 't2', symbol: 'META', type: 'BUY', quantity: 100, price: 701.41, date: '2025-07-17', total: 70141 },
        't3': { id: 't3', symbol: 'TSLA', type: 'BUY', quantity: 100, price: 319.41, date: '2025-07-17', total: 31941 },
        't4': { id: 't4', symbol: 'AAPL', type: 'BUY', quantity: 100, price: 210.02, date: '2025-07-17', total: 21002 },
        't5': { id: 't5', symbol: 'MSFT', type: 'BUY', quantity: 100, price: 511.70, date: '2025-07-17', total: 51170 },
        't6': { id: 't6', symbol: 'GOOGL', type: 'BUY', quantity: 100, price: 183.58, date: '2025-07-17', total: 18358 },
        't7': { id: 't7', symbol: 'AMZN', type: 'BUY', quantity: 100, price: 223.88, date: '2025-07-17', total: 22388 },
    },
    orders: {},
    opportunities: {},
    marketData: {},
    watchList: {
        'AAPL': { symbol: 'AAPL', name: 'Apple Inc.' },
        'MSFT': { symbol: 'MSFT', name: 'Microsoft Corporation' },
        'GOOGL': { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        'AMZN': { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corporation' },
        'META': { symbol: 'META', name: 'Meta Platforms Inc.' },
        'TSLA': { symbol: 'TSLA', name: 'Tesla Inc.' },
    },
    appSettings: {
        'main': { onboardingSeen: false, riskLevel: 'Moderate', guestMode: false }
    },
    syncMetadata: {
        'main': { 
            lastMarketRefresh: null, 
            lastStrategiesScan: null, 
            lastTradesSync: null, 
            lastLeaderboardUpdate: null,
            lastEquitySnapshot: null,
            lastPortfolioSync: null,
            lastPositionsSync: null,
            lastCalendarSync: null,
            lastCorporateActionsSync: null,
            lastCommunitySync: null,
            lastPredictionSync: null
        }
    },
    equityCurve: {},
    predictionHistory: {},
    corporateActions: {},
    marketCalendar: {},
    marketCache: {}
};
