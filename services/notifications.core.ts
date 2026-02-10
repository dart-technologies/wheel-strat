import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { Config } from '@/config';

type FirestoreAdapter = {
    doc: (...args: any[]) => any;
    setDoc: (...args: any[]) => Promise<void>;
    serverTimestamp: (...args: any[]) => any;
};

type NotificationsDeps = {
    getDb: () => any;
    firestore: FirestoreAdapter;
};

const configureNotificationHandler = () => {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
};

export const createNotificationsService = ({ getDb, firestore }: NotificationsDeps) => {
    configureNotificationHandler();

    const registerForPushNotifications = async (): Promise<string | null> => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return null;
        }

        try {
            const projectId = Config.expo.projectId;
            const tokenData = await Notifications.getExpoPushTokenAsync(
                projectId ? { projectId } : undefined
            );
            const token = tokenData.data;

            const db = getDb();
            await firestore.setDoc(
                firestore.doc(db, 'deviceTokens', token),
                {
                    token,
                    tokenType: 'expo',
                    platform: Platform.OS,
                    createdAt: firestore.serverTimestamp(),
                    updatedAt: firestore.serverTimestamp()
                },
                { merge: true }
            );

            console.log('Push token registered:', token);
            return token;
        } catch (error) {
            console.error('Failed to get push token:', error);
            return null;
        }
    };

    const setupNotificationListeners = () => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as Record<string, string>;
            console.log('Notification tapped with data:', data);

            if (data.type === 'market_scan') {
                const reportId = typeof data.reportId === 'string' ? data.reportId : undefined;
                if (reportId) {
                    router.push({ pathname: '/(tabs)/strategies', params: { reportId } });
                } else {
                    router.push('/(tabs)/strategies');
                }
            } else if (data.type === 'position_alert' && data.symbol) {
                // Navigate to opportunity detail screen for the symbol
                router.push(`/opportunity/${data.symbol}`);
            }
        });

        const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received in foreground:', notification);
        });

        return () => {
            subscription.remove();
            foregroundSubscription.remove();
        };
    };

    const scheduleTestNotification = async () => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "GOOGL volatility spike",
                body: "High‑vol regime detected. Tap to review a live wheel opportunity.",
                data: {
                    type: 'position_alert',
                    symbol: 'GOOGL',
                    changePercent: '3.2',
                    suggestedStrategy: 'Covered Call'
                }
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 }
        });
    };

    return {
        registerForPushNotifications,
        setupNotificationListeners,
        scheduleTestNotification
    };
};
