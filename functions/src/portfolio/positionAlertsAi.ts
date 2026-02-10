import { getGenerativeModel } from "@/lib/vertexai";

type AlertContextInput = {
    symbol: string;
    type: "price" | "rsi" | "iv";
    message: string;
    price: number;
    rsi: number;
    iv: number;
};

export async function generateAlertContext(
    input: AlertContextInput
): Promise<{ reasoning: string; strategy: string } | null> {
    try {
        const generativeModel = getGenerativeModel("gemini-3-flash-preview", [{ googleSearch: {} }]);
        const prompt = `
        Symbol ${input.symbol} details:
        - Price: $${input.price}
        - Move: ${input.type === "price" ? input.message : "N/A"}
        - RSI: ${input.rsi.toFixed(0)}
        - IV Rank: ${input.iv}
        - Alert Type: ${input.type.toUpperCase()} (${input.message})

        Task:
        1. Search Google News for this stock from the LAST 12 HOURS.
        2. Explain WHY this move is happening (catalyst).
        3. Suggest a trading strategy (Covered Call, Cash-Secured Put, or Hold).

        Output strictly as JSON:
        {
            "reasoning": "...",
            "strategy": "..."
        }
        Keep reasoning under 200 chars.
        `;

        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const json = JSON.parse(cleaned);
        if (!json?.reasoning || !json?.strategy) return null;
        return { reasoning: json.reasoning, strategy: json.strategy };
    } catch (error) {
        console.error("AI Alert Gen failed, using fallback:", error);
        return null;
    }
}
