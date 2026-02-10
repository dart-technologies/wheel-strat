import * as admin from "firebase-admin";
import type { NormalizedPosition } from "./communityPortfolioUtils";
import { stripUndefined } from "./communityPortfolioUtils";

type PersistOptions = {
    positions: NormalizedPosition[];
    summary: Record<string, unknown>;
    positionsCollection: string;
    portfolioDocPath: string;
    buildDocId: (position: NormalizedPosition) => string | null;
    userId?: string;
    docIdPrefix?: string;
    includeUserIdField?: boolean;
    filterUserId?: string;
};

export async function persistPortfolioSnapshot(options: PersistOptions) {
    const db = admin.firestore();
    const positionsCol = db.collection(options.positionsCollection);
    const portfolioDoc = db.doc(options.portfolioDocPath);

    const existingSnapshot = options.filterUserId
        ? await positionsCol.where("userId", "==", options.filterUserId).get()
        : await positionsCol.get();
    const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));
    const nextIds = new Set<string>();

    let removed = 0;
    let batch = db.batch();
    let batchCount = 0;
    const commitBatch = async () => {
        if (batchCount === 0) return;
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
    };

    for (const pos of options.positions) {
        const baseId = options.buildDocId(pos);
        if (!baseId) continue;
        const docId = options.docIdPrefix ? `${options.docIdPrefix}_${baseId}` : baseId;
        nextIds.add(docId);
        const docRef = positionsCol.doc(docId);

        const payload = stripUndefined({
            ...pos,
            ...(options.includeUserIdField && options.userId ? { userId: options.userId } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batch.set(docRef, payload, { merge: true });
        batchCount++;
        if (batchCount >= 450) {
            await commitBatch();
        }
    }

    existingIds.forEach((id) => {
        if (!nextIds.has(id)) {
            batch.delete(positionsCol.doc(id));
            removed += 1;
            batchCount++;
        }
    });

    batch.set(portfolioDoc, stripUndefined({
        ...options.summary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }), { merge: true });
    batchCount++;

    await commitBatch();

    return { removed };
}
