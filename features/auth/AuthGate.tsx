import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { getAuth, signInWithCredential, GoogleAuthProvider, AppleAuthProvider } from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    Pressable,
    View,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { Theme } from "@/constants/theme";
import GlassCard from "@/components/GlassCard";
import AnimatedLayout from "@/components/AnimatedLayout";

interface AuthGateProps {}

export default function AuthGate({}: AuthGateProps) {
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        const configureGoogleSignIn = async () => {
            try {
                await GoogleSignin.configure();
            } catch (error) {
                console.warn("Google Sign-In configuration failed:", error);
            }
        };

        configureGoogleSignIn();
    }, []);

    const onGoogleButtonPress = async () => {
        setLoading("google");
        try {
            // Check if your device supports Google Play
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            // Get the users ID token
            const response = await GoogleSignin.signIn();
            const idToken = response.data?.idToken;

            if (!idToken) {
                throw new Error("No ID token found");
            }

            // Create a Google credential with the token
            const googleCredential = GoogleAuthProvider.credential(idToken);
            // Sign-in the user with the credential
            await signInWithCredential(getAuth(), googleCredential);
        } catch (error: any) {
            console.error(error);
            Alert.alert("Google Sign-In Error", error.message);
        } finally {
            setLoading(null);
        }
    };

    const onAppleButtonPress = async () => {
        setLoading("apple");
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            const { identityToken } = credential;
            if (identityToken) {
                const appleCredential = AppleAuthProvider.credential(identityToken);
                await signInWithCredential(getAuth(), appleCredential);
            }
        } catch (e: any) {
            if (e.code !== "ERR_REQUEST_CANCELED") {
                console.error(e);
                Alert.alert("Apple Sign-In Error", e.message);
            }
        } finally {
            setLoading(null);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <BlurView intensity={Theme.blur.strong} style={StyleSheet.absoluteFill} tint="dark" />

            <AnimatedLayout style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} contentFit="cover" />
                    </View>
                    <Text style={styles.title}>Wheel Strat</Text>
                    <Text style={styles.subtitle}>options trading</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <Text style={styles.cardDescription}>
                    </Text>

                    <View style={styles.buttonContainer}>
                        {/* Google Sign-In */}
                        <Pressable
                            style={[styles.authButton, styles.googleButton]}
                            onPress={onGoogleButtonPress}
                            disabled={!!loading}
                        >
                            {loading === "google" ? (
                                <ActivityIndicator color={Theme.colors.white} />
                            ) : (
                                <>
                                    <Ionicons name="logo-google" size={20} color={Theme.colors.white} />
                                    <Text style={styles.authButtonText}>Continue with Google</Text>
                                </>
                            )}
                        </Pressable>

                        {/* Apple Sign-In - iOS Only */}
                        {Platform.OS === "ios" && (
                            <Pressable
                                style={[styles.authButton, styles.appleButton]}
                                onPress={onAppleButtonPress}
                                disabled={!!loading}
                            >
                                {loading === "apple" ? (
                                    <ActivityIndicator color={Theme.colors.background} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-apple" size={20} color={Theme.colors.background} />
                                        <Text style={[styles.authButtonText, { color: Theme.colors.background }]}>
                                            Continue with Apple
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        )}
                    </View>
                </GlassCard>


            </AnimatedLayout>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        flex: 1,
        width: "100%",
        paddingHorizontal: Theme.spacing.xl,
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        alignItems: "center",
        marginBottom: Theme.spacing.xxl,
    },
    logoContainer: {
        width: Theme.layout.logoSize,
        height: Theme.layout.logoSize,
        borderRadius: Theme.borderRadius.xl,
        backgroundColor: Theme.colors.glass,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: Theme.spacing.lg,
        borderWidth: 1,
        borderColor: Theme.colors.activeConfigBorder,
    },
    logoImage: {
        width: Theme.layout.logoSize,
        height: Theme.layout.logoSize,
        borderRadius: Theme.borderRadius.xl,
    },
    title: {
        fontSize: Theme.typography.sizes.display,
        fontWeight: Theme.typography.weights.extraBold,
        color: Theme.colors.white,
        marginBottom: Theme.spacing.xs,
    },
    subtitle: {
        fontSize: Theme.typography.sizes.md,
        color: Theme.colors.textMuted,
        textAlign: "center",
    },
    card: {
        width: "100%",
        borderRadius: Theme.borderRadius.xxl,
    },
    cardContent: {},
    cardTitle: {
        fontSize: Theme.typography.sizes.xl,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
        marginBottom: Theme.spacing.sm,
        textAlign: "center",
    },
    cardDescription: {
        fontSize: Theme.typography.sizes.md,
        color: Theme.colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
    },
    buttonContainer: {
        gap: Theme.spacing.md,
    },
    authButton: {
        flexDirection: "row",
        height: Theme.layout.buttonHeight,
        borderRadius: Theme.borderRadius.lg,
        justifyContent: "center",
        alignItems: "center",
        gap: Theme.spacing.sm,
    },
    googleButton: {
        backgroundColor: Theme.colors.google,
    },
    appleButton: {
        backgroundColor: Theme.colors.white,
    },
    guestButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: Theme.colors.guestBorder,
    },
    authButtonText: {
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.white,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: Theme.spacing.sm,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: Theme.colors.dividerLine,
    },
    dividerText: {
        marginHorizontal: Theme.spacing.md,
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
    },
    footerText: {
        marginTop: Theme.spacing.xl,
        textAlign: "center",
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        paddingHorizontal: Theme.spacing.xl,
    },
});
