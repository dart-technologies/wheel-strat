import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getGenerativeModel } from "@/lib/vertexai";
import { EXPLAINER_PROMPT } from "@/prompts/explainer";

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * explainTrade - Generate AI explanation for an options trade
 * 
 * Features:
 * - Caches explanations in Firestore for 24 hours
 * - Returns cached response if available and not expired
 * - Supports forceRefresh to regenerate explanation
 * - Returns generatedAt timestamp for UI display
 */
export const explainTrade = onCall({
    memory: "512MiB",
    timeoutSeconds: 60
}, async (request) => {
    const generativeModel = getGenerativeModel("gemini-3-flash-preview", [{ googleSearch: {} }]);
    const data = request.data;
    const {
        symbol,
        strategy,
        strike,
        expiration,
        premium,
        traderLevel = 'Intermediate',
        now: clientNow, // Accept simulated date from client
        forceRefresh = false
    } = data;

    const db = admin.firestore();

    // Validate required fields
    if (!symbol || !strategy) {
        throw new HttpsError(
            "invalid-argument",
            "Symbol and Strategy are required."
        );
    }

    // Generate cache key from trade parameters
    const cacheKey = `${symbol}-${strategy.replace(/ /g, '')}-${strike || 'any'}-${expiration || 'any'}-${traderLevel}`;

    console.log(`explainTrade called: ${cacheKey}, forceRefresh=${forceRefresh}`);
    console.log("Data keys:", Object.keys(data));
    console.log("clientNow received:", clientNow);

    // Check cache unless forceRefresh
    if (!forceRefresh) {
        try {
            const cachedDoc = await db.collection('explanations').doc(cacheKey).get();

            if (cachedDoc.exists) {
                const cachedData = cachedDoc.data()!;
                const generatedAt = cachedData.generatedAt?.toDate?.()
                    ? cachedData.generatedAt.toDate()
                    : new Date(cachedData.generatedAt);
                const age = Date.now() - generatedAt.getTime();

                if (age < CACHE_TTL_MS) {
                    console.log(`Cache hit for ${cacheKey}, age: ${Math.round(age / 60000)} minutes`);
                    return {
                        explanation: cachedData.explanation,
                        generatedAt: generatedAt.toISOString(),
                        cached: true,
                        cacheAge: Math.round(age / 60000) // age in minutes
                    };
                } else {
                    console.log(`Cache expired for ${cacheKey}`);
                }
            }
        } catch (e) {
            console.log("Cache lookup failed, generating fresh:", e);
        }
    }

    try {
        console.log(`Generating new explanation for ${cacheKey}`);

        // Fetch Previous Analysis for Delta (Bootstrap)
        let prevAnalysis = "None available.";
        let prevDate = "N/A";
        try {
            const prevQuery = await db.collection('explanations')
                .where('context.symbol', '==', symbol)
                .where('context.strategy', '==', strategy)
                .orderBy('generatedAt', 'desc')
                .limit(1)
                .get();

            if (!prevQuery.empty) {
                const prevDoc = prevQuery.docs[0].data();
                prevAnalysis = prevDoc.explanation.substring(0, 500) + "..."; // Truncate
                prevDate = prevDoc.generatedAt.toDate().toISOString().split('T')[0];
                console.log(`Found previous analysis from ${prevDate}`);
            }
        } catch (e) {
            console.warn("Failed to fetch previous analysis:", e);
        }

        // Construct the prompt with trade context
        // Calculate DTE and Today using Client Date (for simulation support)
        const today = clientNow ? new Date(clientNow) : new Date();
        let dte = "N/A";

        if (expiration) {
            // Parse YYYYMMDD
            const expYear = parseInt(expiration.substring(0, 4));
            const expMonth = parseInt(expiration.substring(4, 6)) - 1;
            const expDay = parseInt(expiration.substring(6, 8));
            const expDate = new Date(expYear, expMonth, expDay);

            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // User requested purely positive DTE (treating distance as magnitude)
            // This handles cases where simulated dates might be ahead of stale data
            const absDays = Math.abs(diffDays);
            dte = absDays.toString();
            console.log(`DTE Calc: Today=${today.toISOString()}, Exp=${expDate.toISOString()}, Days=${diffDays}, Used=${absDays}`);
        }

        // Format expiration for readability (YYYYMMDD -> YYYY-MM-DD)
        const formattedExp = expiration && expiration.length === 8
            ? `${expiration.substring(0, 4)}-${expiration.substring(4, 6)}-${expiration.substring(6, 8)}`
            : expiration;

        // Construct the prompt with trade context
        const prompt = EXPLAINER_PROMPT
            .replace("{{symbol}}", symbol)
            .replace("{{traderLevel}}", traderLevel)
            .replace("{{strategy}}", strategy)
            .replace("{{strike}}", strike?.toString() || "N/A")
            .replace("{{expiration}}", formattedExp || "N/A")
            .replace("{{dte}}", dte)
            .replace("{{today}}", today.toISOString().split('T')[0])
            .replace("{{premium}}", premium?.toString() || "N/A")
            .replace("{{prevDate}}", prevDate)
            .replace("{{prevAnalysis}}", prevAnalysis);

        // Call Vertex AI
        console.log(`Calling Vertex AI model...`);
        const result = await generativeModel.generateContent(prompt);
        // Wrapper now exposes text() helper directly on the result object
        // We can still access result.response if needed, but text() handles provider differences
        const text = result.text();

        if (!text) {
            throw new Error("No response from Vertex AI (empty text)");
        }

        let analysisData: any = { verdict: text }; // Fallback
        let explanationText = text;

        try {
            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            analysisData = JSON.parse(jsonStr);

            // For backward compatibility, use the thesis or recommendation as the main text
            if (analysisData.analysis && analysisData.analysis.thesis) {
                explanationText = `${analysisData.analysis.recommendation}: ${analysisData.analysis.thesis}`;
            }
        } catch (e) {
            console.warn("Failed to parse explainTrade JSON, using raw text", e);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

        // Cache the result in Firestore
        await db.collection('explanations').doc(cacheKey).set({
            explanation: explanationText, // Backward comaptibility
            analysis: analysisData,       // New structured data
            generatedAt: now,
            expiresAt,
            context: {
                symbol,
                strategy,
                strike,
                expiration,
                premium,
                traderLevel
            }
        });

        console.log(`Cached new explanation for ${cacheKey}`);

        return {
            explanation: explanationText,
            analysis: analysisData,
            generatedAt: now.toISOString(),
            cached: false,
            cacheAge: 0
        };

    } catch (error: any) {
        console.error("Error calling Vertex AI:", error);
        throw new HttpsError(
            "internal",
            error.message || "Failed to generate explanation."
        );
    }
});
