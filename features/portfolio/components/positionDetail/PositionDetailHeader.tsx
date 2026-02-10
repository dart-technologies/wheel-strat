import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { styles } from './styles';

type PositionDetailHeaderProps = {
    symbol: string;
    onBack: () => void;
};

export function PositionDetailHeader({ symbol, onBack }: PositionDetailHeaderProps) {
    return (
        <View style={styles.headerRow}>
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBack();
                }}
                style={styles.navButton}
                testID="header-back"
            >
                <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
            </Pressable>
            <Text style={styles.headerTitle} testID="page-title">{symbol} Position</Text>
            <View style={{ width: 24 }} />
        </View>
    );
}
