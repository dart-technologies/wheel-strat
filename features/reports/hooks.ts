import { useEffect, useState } from 'react';
import { fetchLatestReport, fetchReportById } from '@/services/api';
import { ReportData } from '@wheel-strat/shared';

export function useReport(id?: string) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) {
            setReport(null);
            setLoading(false);
            return;
        }
        let isActive = true;
        setLoading(true);

        fetchReportById(id)
            .then((result) => {
                if (isActive) {
                    if (result.error) {
                        console.error('Error fetching report:', result.error);
                        setReport(null);
                    } else {
                        setReport(result.data);
                    }
                }
            })
            .catch((error) => {
                console.error('Error fetching report:', error);
            })
            .finally(() => {
                if (isActive) {
                    setLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [id]);

    return { report, loading };
}

export function useLatestReport(enabled = true) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(enabled);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        let isActive = true;
        setLoading(true);

        fetchLatestReport()
            .then((result) => {
                if (isActive) {
                    if (result.error) {
                        console.error('Error fetching latest report:', result.error);
                        setReport(null);
                    } else {
                        setReport(result.data);
                    }
                }
            })
            .catch((error) => {
                console.error('Error fetching latest report:', error);
            })
            .finally(() => {
                if (isActive) {
                    setLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [enabled]);

    return { report, loading };
}
