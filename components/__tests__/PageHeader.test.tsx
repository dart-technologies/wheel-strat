import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
    it('renders correctly with title only', () => {
        const tree = render(<PageHeader title="Test Title" />).toJSON();
        expect(tree).toMatchSnapshot();
    });

    it('renders correctly with title and subtitle', () => {
        const tree = render(
            <PageHeader title="Test Title" subtitle="Test Subtitle" />
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    it('renders correctly with right element', () => {
        const tree = render(
            <PageHeader
                title="Test Title"
                rightElement={<View><Text>Right</Text></View>}
            />
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
