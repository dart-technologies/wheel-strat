import { refreshLiveOptionData } from '../liveOptions';
import { refreshLiveOptions } from '@/services/api';
import { store } from '@/data/store';

jest.mock('@/services/api', () => ({
    refreshLiveOptions: jest.fn()
}));

jest.mock('@/data/store', () => ({
    store: {
        setCell: jest.fn(),
        getRow: jest.fn(),
        getTable: jest.fn()
    }
}));

// Mock store module
jest.mock('../store', () => ({
    applyLiveOptionMarketData: jest.fn().mockReturnValue({ updatedSymbols: ['AAPL'], netLiq: 1000 }),
    refreshPortfolioNetLiq: jest.fn().mockReturnValue(1000)
}));

describe('liveOptions market data', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('persists lastMarketRefresh timestamp on successful refresh', async () => {
        (refreshLiveOptions as jest.Mock).mockResolvedValue({
            data: { results: [{ symbol: 'AAPL', currentPrice: 150 }] }
        });

        await refreshLiveOptionData(['AAPL']);

        expect(store.setCell).toHaveBeenCalledWith(
            'syncMetadata', 
            'main', 
            'lastMarketRefresh', 
            expect.any(String)
        );
    });
});
