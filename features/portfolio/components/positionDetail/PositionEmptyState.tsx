import { Pressable, Text, View } from 'react-native';
import { styles } from './styles';

type PositionEmptyStateProps = {
    onBack: () => void;
};

export function PositionEmptyState({ onBack }: PositionEmptyStateProps) {
    return (
        <View style={styles.center}>
            <Text style={styles.errorText}>Position not found</Text>
            <Pressable onPress={onBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
        </View>
    );
}
