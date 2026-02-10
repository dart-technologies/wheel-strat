import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BridgeStatus from '../BridgeStatus';
import { useBridgeHealth } from '@/hooks/useBridgeHealth';

// Mock useBridgeHealth
jest.mock('@/hooks/useBridgeHealth');

describe('BridgeResilience', () => {
    it('should show OFFLINE when bridge is unreachable', () => {
        (useBridgeHealth as jest.Mock).mockReturnValue({
            status: 'offline',
            latency: null,
            healthSnapshot: null,
            lastCheckedAt: null,
            refresh: jest.fn()
        });

        const { getByText } = render(<BridgeStatus />);
        expect(getByText('OFFLINE')).toBeTruthy();
    });

    it('should show OFFLINE when gateway is disconnected even if bridge is reachable', () => {
        (useBridgeHealth as jest.Mock).mockReturnValue({
            status: 'no-ib',
            latency: 120,
            healthSnapshot: { connected: false, status: 'error' },
            lastCheckedAt: new Date().toISOString(),
            refresh: jest.fn()
        });

        const { getByText } = render(<BridgeStatus />);
        expect(getByText('OFFLINE')).toBeTruthy();
    });

    it('should show CONNECTING during health check', () => {
        (useBridgeHealth as jest.Mock).mockReturnValue({
            status: 'checking',
            latency: null,
            healthSnapshot: null,
            lastCheckedAt: null,
            refresh: jest.fn()
        });

        const { getByText } = render(<BridgeStatus />);
        expect(getByText('CONNECTING')).toBeTruthy();
    });

    it('should open diagnostics modal when pressed', () => {
        (useBridgeHealth as jest.Mock).mockReturnValue({
            status: 'online',
            latency: 45,
            healthSnapshot: { connected: true, status: 'ok', clientId: 1 },
            lastCheckedAt: new Date().toISOString(),
            refresh: jest.fn()
        });

        const { getByText, queryByText, getByTestId } = render(<BridgeStatus />);
        
        // Modal is initially hidden
        expect(queryByText('System Diagnostics')).toBeNull();

        // Tap the status pill
        fireEvent.press(getByTestId('bridge-status-button')); 
        
        expect(getByText('System Diagnostics')).toBeTruthy();
        expect(getByText('45ms')).toBeTruthy();
    });
});
