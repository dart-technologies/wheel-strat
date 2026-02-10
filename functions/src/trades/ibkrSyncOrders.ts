import * as admin from "firebase-admin";
import { IBKROrder } from "./ibkrSyncTypes";
import { buildOrderDocId, stripUndefined } from "./ibkrSyncStore";

export async function writeOpenOrders(orders: IBKROrder[], userId: string) {
    const db = admin.firestore();
    const ordersRef = db.collection("user_orders");
    const existingSnapshot = await ordersRef.where("userId", "==", userId).get();
    const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));
    const nextIds = new Set<string>();

    let removed = 0;
    let batch = db.batch();
    let batchCount = 0;
    const maxBatchSize = 450;

    const dateStr = new Date().toISOString().split("T")[0];

    for (const order of orders) {
        const docId = buildOrderDocId(order, userId);
        nextIds.add(docId);
        const docRef = ordersRef.doc(docId);
        const quantity = Number(order.totalQuantity || 0);
        const price = Number.isFinite(order.lmtPrice)
            ? (order.lmtPrice as number)
            : Number.isFinite(order.auxPrice)
                ? (order.auxPrice as number)
                : Number.isFinite(order.avgFillPrice)
                    ? (order.avgFillPrice as number)
                    : 0;

        batch.set(docRef, stripUndefined({
            orderId: order.orderId,
            permId: order.permId,
            symbol: order.symbol,
            type: order.action || "BUY",
            quantity,
            price,
            date: dateStr,
            total: quantity * price,
            userId,
            status: "Pending",
            orderStatus: order.status,
            orderType: order.orderType,
            tif: order.tif,
            remaining: order.remaining,
            filled: order.filled,
            avgFillPrice: order.avgFillPrice,
            initMarginChange: order.initMarginChange,
            secType: order.secType,
            right: order.right,
            strike: order.strike,
            expiration: order.expiration,
            multiplier: order.multiplier,
            localSymbol: order.localSymbol,
            conId: order.conId,
            account: order.account,
            currency: order.currency,
            exchange: order.exchange,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }), { merge: true });

        batchCount++;
        if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    existingIds.forEach((id) => {
        if (!nextIds.has(id)) {
            batch.delete(ordersRef.doc(id));
            removed += 1;
            batchCount++;
        }
    });

    if (batchCount > 0) {
        await batch.commit();
    }

    return { openOrders: nextIds.size, removed };
}
