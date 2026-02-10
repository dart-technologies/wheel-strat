import type { FirestoreTimestampValue } from '@wheel-strat/shared';

export function toDate(value: FirestoreTimestampValue | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'object' && typeof value.toMillis === 'function') {
        return new Date(value.toMillis());
    }
    return null;
}
