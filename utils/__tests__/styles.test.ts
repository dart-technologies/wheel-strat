import { Theme, Spacing } from '../../constants/theme';
import { layout, typography, glass, shadow, getSpacing } from '../styles';

describe('styles utils', () => {
    describe('layout', () => {
        it('generates flexRow correctly', () => {
            const style = layout.flexRow('space-between', 'flex-start', 10);
            expect(style).toEqual({
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
            });
        });

        it('generates flexColumn correctly', () => {
            const style = layout.flexColumn('center', 'center');
            expect(style).toEqual({
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: Spacing.elementGap,
            });
        });

        it('provides static helpers', () => {
            expect(layout.fill).toEqual({ flex: 1 });
            expect(layout.center).toEqual({ justifyContent: 'center', alignItems: 'center' });
            expect(layout.absoluteFill).toEqual({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
        });
    });

    describe('typography', () => {
        it('generates text styles', () => {
            const style = typography('xl', 'bold');
            expect(style).toEqual({
                fontFamily: Theme.typography.fonts?.primary,
                fontSize: Theme.typography.sizes.xl,
                fontWeight: Theme.typography.weights.bold,
                lineHeight: Theme.typography.lineHeights.xl,
                color: Theme.colors.text
            });
        });
    });

    describe('glass', () => {
        it('generates glass styles', () => {
            const style = glass('strong');
            expect(style).toEqual({
                backgroundColor: Theme.colors.glassStrong,
                borderColor: Theme.colors.glassBorder,
                borderWidth: 1
            });
        });
    });

    describe('shadow', () => {
        it('generates shadow styles', () => {
            const style = shadow('md');
            expect(style).toEqual(Theme.shadows.md);
        });
    });

    describe('getSpacing', () => {
        it('returns spacing value', () => {
            expect(getSpacing('lg')).toBe(24);
        });
    });
});
