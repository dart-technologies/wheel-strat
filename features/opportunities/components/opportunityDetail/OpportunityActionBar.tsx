import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Theme } from "@/constants/theme";
import { styles } from "./styles";

type OpportunityActionBarProps = {
    isAuthenticated: boolean;
    isCoveredCall: boolean;
    executing: boolean;
    strategyColor: string;
    onExecute: () => void;
    style?: StyleProp<ViewStyle>;
};

export default function OpportunityActionBar({
    isAuthenticated,
    isCoveredCall,
    executing,
    strategyColor,
    onExecute,
    style
}: OpportunityActionBarProps) {
    return (
        <View style={style}>
            {/* <View style={styles.actionSummary}>
                <Text style={styles.actionLabel}>Next:</Text>
                <Text style={styles.actionValue}>
                    {isCoveredCall ? "Harvest premium → Accumulate" : "Acquire shares → Harvest premium"}
                </Text>
            </View> */}
            <Pressable
                style={[
                    styles.actionButton,
                    !isAuthenticated ? styles.actionButtonDisabled : null,
                    { backgroundColor: isAuthenticated ? strategyColor : Theme.colors.glassBorder },
                ]}
                onPress={onExecute}
                disabled={executing}
                testID="execute-button"
            >
                {executing ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <>
                        <Text style={[styles.actionButtonText, { color: isAuthenticated ? "white" : Theme.colors.textMuted }]}>
                            {isAuthenticated ? "Execute paper trade" : "Sign in to Execute"}
                        </Text>
                        <Ionicons name="flash" size={18} color={isAuthenticated ? "white" : Theme.colors.textMuted} />
                    </>
                )}
            </Pressable>
        </View>
    );
}
