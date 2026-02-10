import * as admin from "firebase-admin";

export interface PositionSnapshot {
    symbol: string;
    previousClose: number;
    lastChecked: admin.firestore.Timestamp;
}
