import { createApiService } from '../api.core';

describe('API Resilience', () => {
    const mockDb = {};
    const mockFunctions = {};
    const firestoreMock = {
        collection: jest.fn(),
        doc: jest.fn(),
        getDoc: jest.fn(),
        getDocs: jest.fn(),
        limit: jest.fn(),
        onSnapshot: jest.fn(),
        orderBy: jest.fn(),
        query: jest.fn(),
        where: jest.fn(),
    };
    const functionsMock = {
        httpsCallable: jest.fn(),
    };

    const service = createApiService({
        getDb: () => mockDb,
        firestore: firestoreMock as any,
        httpsCallable: functionsMock.httpsCallable as any,
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should propagate errors from listenToOpportunities', () => {
        const onError = jest.fn();
        const testError = new Error('Firestore Permission Denied');
        
        firestoreMock.onSnapshot.mockImplementation((q, onNext, onErrorCallback) => {
            onErrorCallback(testError);
            return jest.fn(); // unsubscribe
        });

        service.listenToOpportunities({}, jest.fn(), onError);
        expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should handle fetchUserTrades errors gracefully', async () => {
        const testError = new Error('Network timeout');
        firestoreMock.getDocs.mockRejectedValue(testError);

        const result = await service.fetchUserTrades('user_1');
        expect(result.error).toBe(testError);
        expect(result.data).toBeNull();
    });

    it('should handle explainTrade callable errors', async () => {
        const testError = new Error('AI Model Overloaded');
        const mockCallable = jest.fn().mockRejectedValue(testError);
        functionsMock.httpsCallable.mockReturnValue(mockCallable);

        const result = await service.explainTrade({ symbol: 'AAPL' } as any);
        expect(result.error).toBe(testError);
    });

    it('should handle listenToOpportunitySynopsis missing doc', () => {
        const onData = jest.fn();
        firestoreMock.onSnapshot.mockImplementation((ref, onNext) => {
            onNext({ exists: () => false, data: () => null });
            return jest.fn();
        });

        service.listenToOpportunitySynopsis(onData);
        expect(onData).toHaveBeenCalledWith('');
    });
});
