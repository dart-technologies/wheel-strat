import { startSyncServices } from '../sync';
import { listenToOpportunities, listenToOpportunitySynopsis } from '../api';
import { store } from '@/data/store';

jest.mock('../api', () => ({
    listenToOpportunities: jest.fn(),
    listenToOpportunitySynopsis: jest.fn()
}));

jest.mock('@/data/store', () => ({
    store: {
        transaction: (cb: any) => cb(),
        setRow: jest.fn(),
        setCell: jest.fn()
    }
}));

describe('Sync Services', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates lastStrategiesScan when new opportunities arrive', () => {
        let capturedCallback: any;
        (listenToOpportunities as jest.Mock).mockImplementation((options, cb) => {
            capturedCallback = cb;
            return jest.fn(); // Unsubscribe
        });
        (listenToOpportunitySynopsis as jest.Mock).mockReturnValue(jest.fn());

        startSyncServices();

        // Simulate Firestore update
        const mockOpps = [
            { symbol: 'AAPL', strategy: 'CC', strike: 200, createdAt: new Date().toISOString() }
        ];
        
        capturedCallback(mockOpps);

        expect(store.setCell).toHaveBeenCalledWith(
            'syncMetadata', 
            'main', 
            'lastStrategiesScan', 
            expect.any(String)
        );
    });
});
