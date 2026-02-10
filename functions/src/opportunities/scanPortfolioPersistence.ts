import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Opportunity } from "@wheel-strat/shared";

export const persistOpportunities = async (
    top3: Opportunity[],
    synopsis: string
) => {
    console.log("Persisting to Firestore...");
    const db = admin.firestore();
    const batch = db.batch();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL

    // Clear old opportunities first
    const existingOpps = await db.collection("opportunities").get();
    existingOpps.docs.forEach((doc) => batch.delete(doc.ref));

    // Add new opportunities
    for (const opp of top3) {
        const docId = `${opp.symbol}-${opp.strategy.replace(/ /g, "")}`;
        const docRef = db.collection("opportunities").doc(docId);
        batch.set(docRef, {
            ...opp,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt
        });
    }

    // Store synopsis in a metadata document
    const metaRef = db.collection("opportunities").doc("metadata");
    batch.set(metaRef, {
        summary: synopsis,
        updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log(`✅ Saved ${top3.length} opportunities and metadata to Firestore`);
};
