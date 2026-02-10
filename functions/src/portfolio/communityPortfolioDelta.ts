import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const chunkArray = <T>(items: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const parseSinceDate = (value?: unknown) => {
    if (typeof value !== "string") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

export const getCommunityPortfolioUpdates = onCall({
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public"
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be signed in to fetch community updates.");
    }

    const sinceDate = parseSinceDate(request.data?.since);
    const rawKnownIds = Array.isArray(request.data?.knownIds) ? request.data.knownIds : [];
    const knownIds = rawKnownIds
        .filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        .slice(0, 500);

    const db = admin.firestore();
    let positionsQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("community_positions");
    if (sinceDate) {
        positionsQuery = positionsQuery.where("updatedAt", ">", sinceDate);
    }

    const positionsSnap = await positionsQuery.get();
    const positions = positionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    let removedIds: string[] = [];
    if (knownIds.length > 0) {
        const existing = new Set<string>();
        const idField = admin.firestore.FieldPath.documentId();
        const chunks = chunkArray(knownIds, 10);
        for (const chunk of chunks) {
            const chunkSnap = await db.collection("community_positions").where(idField, "in", chunk).get();
            chunkSnap.docs.forEach((doc) => existing.add(doc.id));
        }
        removedIds = knownIds.filter((id: string) => !existing.has(id));
    }

    const portfolioSnap = await db.collection("community_portfolio").doc("main").get();
    const portfolio = portfolioSnap.exists ? (portfolioSnap.data() as Record<string, unknown>) : {};

    logger.info("Community delta sync", {
        uid: request.auth.uid,
        since: sinceDate?.toISOString() ?? null,
        positions: positions.length,
        removed: removedIds.length
    });

    return {
        updatedAt: new Date().toISOString(),
        positions,
        removedIds,
        portfolio
    };
});
