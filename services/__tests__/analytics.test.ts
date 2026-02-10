import { Analytics } from '../analytics';
import { logEvent as firebaseLogEvent } from '@react-native-firebase/analytics';

// Correctly mock the named exports
jest.mock('@react-native-firebase/analytics', () => {
    const mockLogEvent = jest.fn();
    return {
        __esModule: true,
        default: jest.fn(() => ({
            logEvent: mockLogEvent,
            logScreenView: jest.fn(),
        })),
        getAnalytics: jest.fn(() => ({})),
        logEvent: mockLogEvent,
    };
});

describe('Analytics Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('logs screen view', async () => {
        await Analytics.logScreenView('TestScreen');
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'screen_view', {
            screen_name: 'TestScreen',
            screen_class: 'TestScreen',
        });
    });

    it('logs trade execution', async () => {
        await Analytics.logTradeExecution('AAPL', 'Manual');
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'trade_execution', {
            symbol: 'AAPL',
            strategy: 'Manual'
        });
    });

    it('logs scan trigger', async () => {
        await Analytics.logScanTriggered('High', { dteWindow: 'week' });
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'scan_opportunities', {
            risk_level: 'High',
            dte_window: 'week'
        });
    });

    it('logs strategy explanation', async () => {
        await Analytics.logStrategyExplanation('TSLA', 'CSP');
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'strategy_explanation_view', {
            symbol: 'TSLA',
            strategy: 'CSP'
        });
    });

    it('logs opportunity view', async () => {
        await Analytics.logOpportunityView('MSFT', 'CC');
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'opportunity_view', {
            symbol: 'MSFT',
            strategy: 'CC'
        });
    });

    it('logs position view', async () => {
        await Analytics.logPositionView('GOOGL');
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'position_view', {
            symbol: 'GOOGL'
        });
    });

    it('logs generic event', async () => {
        await Analytics.logEvent('custom_event', { foo: 'bar' });
        expect(firebaseLogEvent).toHaveBeenCalledWith(expect.anything(), 'custom_event', {
            foo: 'bar'
        });
    });

    it('handles errors gracefully', async () => {
        (firebaseLogEvent as jest.Mock).mockRejectedValueOnce(new Error('Analytics error'));
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        await Analytics.logEvent('fail_event');
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to log'), expect.any(Error));
        consoleSpy.mockRestore();
    });
});
