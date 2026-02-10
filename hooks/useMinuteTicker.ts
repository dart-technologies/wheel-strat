import { useEffect, useState } from 'react';

export const useMinuteTicker = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);
};
