import { useCallback, useEffect, useState } from 'react';
import { BridgeHealth, checkBridgeHealth } from '@/services/trading';

import { Result } from '@wheel-strat/shared';

export type BridgeConnectionStatus = 'checking' | 'online' | 'offline' | 'no-ib';

export interface BridgeHealthState {
    status: BridgeConnectionStatus;
    latency?: number;
    healthSnapshot: BridgeHealth | null;
    lastCheckedAt: number;
}

const CHECK_INTERVAL_MS = 300000;

let state: BridgeHealthState = {
    status: 'checking',
    latency: undefined,
    healthSnapshot: null,
    lastCheckedAt: 0,
};

let inflight: Promise<Result<BridgeHealth>> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(next: BridgeHealthState) => void>();

function notify() {
    listeners.forEach((listener) => listener(state));
}

function setState(partial: Partial<BridgeHealthState>) {
    state = { ...state, ...partial };
    notify();
}

function computeStatus(health: BridgeHealth): BridgeConnectionStatus {
    if (health.online) {
        return health.connected === false ? 'no-ib' : 'online';
    }
    return 'offline';
}

async function performCheck(force = false): Promise<BridgeHealthState> {
    const now = Date.now();
    if (!force && state.healthSnapshot && (now - state.lastCheckedAt) < CHECK_INTERVAL_MS) {
        return state;
    }

    if (inflight) {
        setState({ status: 'checking' });
        await inflight;
        return state;
    }

    setState({ status: 'checking' });
    const request = checkBridgeHealth();
    inflight = request;
    try {
        const result = await request;
        if (inflight === request) {
            inflight = null;
        }

        if (result.error) {
            setState({
                healthSnapshot: { online: false, error: result.error.message },
                latency: undefined,
                lastCheckedAt: Date.now(),
                status: 'offline',
            });
        } else {
            const health = result.data;
            setState({
                healthSnapshot: health,
                latency: health.latency,
                lastCheckedAt: Date.now(),
                status: computeStatus(health),
            });
        }
        return state;
    } catch (error) {
        if (inflight === request) {
            inflight = null;
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState({
            healthSnapshot: { online: false, error: message },
            latency: undefined,
            lastCheckedAt: Date.now(),
            status: 'offline',
        });
        return state;
    }
}

function startPolling() {
    if (interval) return;
    performCheck(false);
    interval = setInterval(() => {
        performCheck(false);
    }, CHECK_INTERVAL_MS);
}

function stopPolling() {
    if (!interval) return;
    clearInterval(interval);
    interval = null;
}

function subscribe(listener: (next: BridgeHealthState) => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
        startPolling();
    }
    listener(state);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            stopPolling();
        }
    };
}

export function useBridgeHealth() {
    const [snapshot, setSnapshot] = useState(state);

    useEffect(() => subscribe(setSnapshot), []);

    const refresh = useCallback((force = true) => performCheck(force), []);

    return {
        ...snapshot,
        refresh,
    };
}

/** @internal - For testing only */
export function _resetInternalStateForTesting() {
    stopPolling();
    state = {
        status: 'checking',
        latency: undefined,
        healthSnapshot: null,
        lastCheckedAt: 0,
    };
    inflight = null;
    listeners.clear();
}

