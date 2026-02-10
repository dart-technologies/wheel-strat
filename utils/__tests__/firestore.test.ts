
import { toDate } from '../firestore';

describe('firestore utils', () => {
    describe('toDate', () => {
        it('returns null for null or undefined', () => {
            expect(toDate(null)).toBeNull();
            expect(toDate(undefined)).toBeNull();
        });

        it('returns Date from number timestamp', () => {
            const result = toDate(1704110400000); // 2024-01-01
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-01-01T12:00:00.000Z');
        });

        it('returns Date from Firestore Timestamp object', () => {
            const mockTimestamp = {
                toMillis: () => 1704110400000
            };
            const result = toDate(mockTimestamp);
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-01-01T12:00:00.000Z');
        });

        it('returns null for invalid input', () => {
            // @ts-ignore
            expect(toDate('invalid' as any)).toBeNull();
        });
    });
});
