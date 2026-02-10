import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import EducationModal from '../EducationModal';

// Mock IntroCarousel as it might be complex
jest.mock('../IntroCarousel', () => 'IntroCarousel');

describe('EducationModal', () => {
    it('renders correctly when visible', () => {
        const tree = render(
            <EducationModal visible={true} onClose={() => { }} />
        ).toJSON();
        expect(tree).toMatchSnapshot();
    });

    it('renders null when not visible', () => {
        const tree = render(
            <EducationModal visible={false} onClose={() => { }} />
        ).toJSON();
        expect(tree).toBeNull();
    });

    it('calls onClose when button is pressed', () => {
        const mockOnClose = jest.fn();
        const { getByText } = render(
            <EducationModal visible={true} onClose={mockOnClose} />
        );

        fireEvent.press(getByText("Let's Wheel 🛞"));
        expect(mockOnClose).toHaveBeenCalled();
    });
});
