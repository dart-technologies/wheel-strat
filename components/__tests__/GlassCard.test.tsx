import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import GlassCard from '../GlassCard';

describe('GlassCard', () => {
    it('renders correctly with default props', () => {
        const tree = render(
            <GlassCard>
                <Text>Test Content</Text>
            </GlassCard>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    it('renders correctly with native glass disabled', () => {
        const tree = render(
            <GlassCard useNativeGlass={false}>
                <Text>Test Content</Text>
            </GlassCard>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    it('applies custom tint and intensity', () => {
        const tree = render(
            <GlassCard tint="light" blurIntensity={50}>
                <Text>Test Content</Text>
            </GlassCard>
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
