import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { createNotificationsService } from './notifications.core';

const service = createNotificationsService({
    getDb: () => db,
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
