import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getDocs, getDoc, onSnapshot } from '@react-native-firebase/firestore';
import {
    explainTrade,
    fetchHistoricalBars,
    fetchOpportunitiesForSymbol,
    fetchRecentOpportunities,
    fetchReportById,
    listenToCommunityTrades,
    listenToOpportunities,
    listenToOpportunitySynopsis,
    listenToUserTrades,
    refreshLiveOptions,
    scanPortfolio
} from '../api';

jest.mock('@react-native-firebase/functions', () => ({
    getFunctions: jest.fn(),
    httpsCallable: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
}));

const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

describe('api service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getFunctions as jest.Mock).mockReturnValue({} as any);
        (httpsCallable as jest.Mock).mockImplementation(mockHttpsCallable);
    });

    describe('Firebase Functions wrappers', () => {
        it('scanPortfolio calls the correct function', async () => {
            mockCallable.mockResolvedValue({ data: { success: true } });

            const result = await scanPortfolio([], 1000, { riskLevel: 'Moderate' });

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'scanPortfolio', expect.anything());
            expect(mockCallable).toHaveBeenCalledWith({ positions: [], cash: 1000, riskLevel: 'Moderate' });
            expect(result).toEqual({ data: { success: true }, error: null });
        });

        it('explainTrade calls the correct function', async () => {
            mockCallable.mockResolvedValue({ data: { explanation: 'test' } });

            const result = await explainTrade({ symbol: 'AAPL', strategy: 'CC' } as any);

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'explainTrade', expect.anything());
            expect(result).toEqual({ data: { explanation: 'test' }, error: null });
        });

        it('refreshLiveOptions calls the correct function', async () => {
            mockCallable.mockResolvedValue({ data: { success: true } });

            const result = await refreshLiveOptions(['AAPL'], 70, 'three_weeks');

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'refreshLiveOptions', expect.anything());
            expect(mockCallable).toHaveBeenCalledWith({ symbols: ['AAPL'], targetWinProb: 70, dteWindow: 'three_weeks' });
            expect(result).toEqual({ data: { success: true }, error: null });
        });

        it('fetchHistoricalBars calls the correct function', async () => {
            mockCallable.mockResolvedValue({ data: [] });

            const result = await fetchHistoricalBars('AAPL', { limit: 10 });

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getHistoricalBars', expect.anything());
            expect(mockCallable).toHaveBeenCalledWith({ symbol: 'AAPL', limit: 10 });
            expect(result).toEqual({ data: [], error: null });
        });
    });

    describe('Firestore fetchers', () => {
        it('fetchOpportunitiesForSymbol returns data', async () => {
            const mockDocs = [{ data: () => ({ symbol: 'AAPL' }) }];
            (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

            const result = await fetchOpportunitiesForSymbol('AAPL');

            expect(result).toEqual({ data: [{ symbol: 'AAPL' }], error: null });
        });

        it('fetchRecentOpportunities returns data', async () => {
            const mockDocs = [{ data: () => ({ id: '1' }) }];
            (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

            const result = await fetchRecentOpportunities();

            expect(result).toEqual({ data: [{ id: '1' }], error: null });
        });

        it('fetchReportById returns report when exists', async () => {
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'report1',
                data: () => ({ title: 'Test Report' })
            });

            const result = await fetchReportById('report1');

            expect(result).toEqual({ data: { id: 'report1', title: 'Test Report' }, error: null });
        });

        it('fetchReportById returns failure when not exists', async () => {
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => false
            });

            const result = await fetchReportById('missing');

            expect(result.data).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('Report missing not found');
        });
    });

    describe('Firestore listeners', () => {
        it('listenToOpportunities sets up subscription', () => {
            const onData = jest.fn();
            const unsubscribe = jest.fn();
            (onSnapshot as jest.Mock).mockReturnValue(unsubscribe);

            const result = listenToOpportunities({}, onData);

            expect(onSnapshot).toHaveBeenCalled();
            expect(result).toBe(unsubscribe);

            const snapshotCallback = (onSnapshot as jest.Mock).mock.calls[0][1];
            snapshotCallback({
                forEach: (cb: any) => cb({ data: () => ({ id: 'opt1' }) })
            });

            expect(onData).toHaveBeenCalledWith([{ id: 'opt1' }]);
        });

        it('listenToOpportunitySynopsis sets up subscription', () => {
            const onData = jest.fn();
            (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

            listenToOpportunitySynopsis(onData);

            const snapshotCallback = (onSnapshot as jest.Mock).mock.calls[0][1];

            snapshotCallback({
                exists: () => true,
                data: () => ({ summary: 'market summary' })
            });
            expect(onData).toHaveBeenCalledWith('market summary');

            snapshotCallback({
                exists: () => false
            });
            expect(onData).toHaveBeenCalledWith('');
        });

        it('listenToUserTrades sets up subscription', () => {
            const onChange = jest.fn();
            (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

            listenToUserTrades('user123', onChange);

            const snapshotCallback = (onSnapshot as jest.Mock).mock.calls[0][1];
            snapshotCallback({
                docChanges: () => [
                    { type: 'added', doc: { id: 't1', data: () => ({ symbol: 'TSLA' }) } }
                ]
            });

            expect(onChange).toHaveBeenCalledWith({ symbol: 'TSLA' }, 't1');
        });

        it('listenToCommunityTrades sets up subscription', () => {
            const onData = jest.fn();
            (onSnapshot as jest.Mock).mockReturnValue(jest.fn());

            listenToCommunityTrades(10, onData);

            const snapshotCallback = (onSnapshot as jest.Mock).mock.calls[0][1];
            snapshotCallback({
                forEach: (cb: any) => cb({ id: 't1', data: () => ({ symbol: 'AAPL' }) })
            });

            expect(onData).toHaveBeenCalledWith([{ symbol: 'AAPL', id: 't1' }]);
        });
    });
});
