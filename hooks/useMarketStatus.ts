import { useEffect, useState } from 'react';
import { getMarketStatus } from '@/utils/marketHours';

export function useMarketStatus(intervalMs = 60000) {
    const [marketStatus, setMarketStatus] = useState(getMarketStatus());

    useEffect(() => {
        const interval = setInterval(() => {
            setMarketStatus(getMarketStatus());
        }, intervalMs);
        return () => clearInterval(interval);
    }, [intervalMs]);

    return marketStatus;
}
