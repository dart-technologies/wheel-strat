declare module '@react-native-firebase/firestore' {
    export type FirestoreInstance = {
        collection: (path: string) => any;
        useEmulator?: (host: string, port: number) => void;
    };

    export const getFirestore: () => FirestoreInstance;
    export const collection: (...args: any[]) => any;
    export const query: (...args: any[]) => any;
    export const where: (...args: any[]) => any;
    export const orderBy: (...args: any[]) => any;
    export const limit: (...args: any[]) => any;
    export const onSnapshot: (...args: any[]) => any;
    export const getDocs: (...args: any[]) => any;
    export const doc: (...args: any[]) => any;
    export const getDoc: (...args: any[]) => any;
    export const setDoc: (...args: any[]) => any;
    export const serverTimestamp: () => any;

    type FirestoreModule = {
        (): FirestoreInstance;
        FieldValue: {
            serverTimestamp: () => any;
        };
    };

    const firestore: FirestoreModule;
    export default firestore;
}
