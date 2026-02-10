import { FirebaseAuthTypes, getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import Constants from 'expo-constants';

export function useAuth() {
    const [initializing, setInitializing] = useState(true);
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

    // Get launch arguments for Detox mocking
    const launchArgs = Constants.expoConfig?.extra?.launchArgs || {};
    const detoxAuth = launchArgs.detoxAuth;

    // Handle user state changes
    function handleAuthStateChanged(fbUser: FirebaseAuthTypes.User | null) {
        if (detoxAuth === 'true') {
            setUser({
                uid: 'detox-user-123',
                email: 'detox@example.com',
                displayName: 'Detox Tester',
                isAnonymous: false,
            } as FirebaseAuthTypes.User);
        } else {
            setUser(fbUser);
        }
        if (initializing) setInitializing(false);
    }

    useEffect(() => {
        const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
        return subscriber; // unsubscribe on unmount
    }, []);

    const signOut = useCallback(async () => {
        try {
            await firebaseSignOut(getAuth());
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    }, []);

    return {
        user,
        isAuthenticated: !!user,
        initializing,
        signOut,
    };
}
