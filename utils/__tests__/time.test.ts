import { formatTimeSince } from '../time';

describe('time utils', () => {
    describe('formatTimeSince', () => {
        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('returns empty string for null date', () => {
            expect(formatTimeSince(null)).toBe('');
        });

        it('returns empty string for invalid date', () => {
            expect(formatTimeSince('not-a-date')).toBe('');
        });

        it('handles Firestore-style timestamps', () => {
            const timestamp = { toDate: () => new Date('2024-01-01T11:00:00Z') };
            expect(formatTimeSince(timestamp)).toBe('1H ago');
        });

        it('returns "Just now" for less than 1 minute', () => {
            const date = new Date('2024-01-01T11:59:30Z');
            expect(formatTimeSince(date)).toBe('Just now');
        });

        it('returns minutes ago for less than 60 minutes', () => {
            const date = new Date('2024-01-01T11:30:00Z');
            expect(formatTimeSince(date)).toBe('30M ago');
        });

        it('returns hours ago for less than 24 hours', () => {
            const date = new Date('2024-01-01T02:00:00Z');
            expect(formatTimeSince(date)).toBe('10H ago');
        });

        it('returns days ago for more than 24 hours', () => {
            const date = new Date('2023-12-25T12:00:00Z');
            expect(formatTimeSince(date)).toBe('7D ago');
        });
    });
});
