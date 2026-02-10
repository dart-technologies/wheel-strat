import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { createNotificationsService } from './notifications.core';

const service = createNotificationsService({
    getDb: () => getFirestore(),
    firestore: {
        doc,
        setDoc,
        serverTimestamp
    }
});

export const {
    registerForPushNotifications,
    setupNotificationListeners,
    scheduleTestNotification
} = service;
