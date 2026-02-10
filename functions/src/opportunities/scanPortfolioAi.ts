import { getGenerativeModel } from "@/lib/vertexai";
import { SCANNER_PROMPT } from "@/prompts/scanner";
import type { Opportunity, Position } from "@wheel-strat/shared";

export const enrichTopOpportunitiesWithAI = async (
    top3: Opportunity[],
    positions: Position[],
    today: string
) => {
    if (!top3.length) return;
    console.log("Generating AI reasoning for top 3 in parallel...");
    const shareOnlyPositions = positions.filter((position) => {
        const raw = position as any;
        return !raw.strike && !raw.expiration && !raw.right && position.quantity > 0;
    });
    const portfolioSummary = shareOnlyPositions
        .map((position) => `${position.symbol}(${position.quantity} @ $${position.averageCost})`)
        .join(", ");
    const modelWithTools = getGenerativeModel("gemini-3-flash-preview", [{ googleSearch: {} }]);

    await Promise.all(top3.map(async (opp, index) => {
        opp.priority = index + 1;
        try {
            const prompt = SCANNER_PROMPT
                .replace(/{{symbol}}/g, opp.symbol)
                .replace(/{{strategy}}/g, opp.strategy)
                .replace(/{{strike}}/g, opp.strike.toString())
                .replace(/{{expiration}}/g, opp.expiration)
                .replace(/{{premium}}/g, opp.premium.toFixed(2))
                .replace(/{{ivRank}}/g, (opp.ivRank || 0).toString())
                .replace(/{{winProb}}/g, (opp.winProb || 0).toString())
                .replace(/{{annualizedYield}}/g, (opp.annualizedYield || 0).toString())
                .replace(/{{portfolioContext}}/g, portfolioSummary)
                .replace(/{{today}}/g, today);

            const result = await modelWithTools.generateContent(prompt);
            const response = await result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
                const analysis = JSON.parse(jsonStr);
                opp.reasoning = analysis.verdict;
                (opp as any).analysis = analysis;
            }
        } catch (error) {
            console.error(`AI reasoning failed for ${opp.symbol}:`, error);
            opp.reasoning = `${opp.strategy} on ${opp.symbol} yielding ${opp.annualizedYield}% annualized.`;
        }
    }));
};

export const generateOpportunitiesSynopsis = async (
    top3: Opportunity[],
    positions: Position[],
    today: string
) => {
    if (!top3.length) {
        return "Analyzing market confluence and volatility regimes for optimal entry.";
    }

    console.log("Generating collective synopsis for Top 3 with search grounding...");
    let synopsis = "Analyzing market confluence and volatility regimes for optimal entry.";
    try {
        const portfolioStr = positions.map((position) => `${position.symbol}`).join(", ");

        const synopsisPrompt = `You are the Chief Investment Officer (CIO) of a boutique quant fund. 
        Provide a deep-dive, high-signal executive synopsis for the Top 3 options opportunities identified today. 
        
        Context:
        Top Picks: ${top3.map(o => `${o.symbol} (${o.strategy})`).join(", ")}
        Portfolio Composition: ${portfolioStr}
        Current Date: ${today}
        
        Instructions:
        1. **Macro Regime & News**: Use Google Search to pinpoint exactly why ${top3.map(o => o.symbol).join(", ")} are the correct plays *this week*. Reference specific market news (earnings, macro data, geopolitical events) if they impact these symbols.
        2. **Relative Value**: Contrast the IV Rank (${top3.map(o => o.ivRank).join("%/")}) against the broader market volatility. Explain the specific catalyst driving the premium in these names.
        3. **Portfolio Fit**: How do these 3 positions work together to provide defensive income given current holdings (${portfolioStr})?
        4. **Hard-Hitting Verdict**: Provide a 3-sentence institutional research note that is dense, technical, and avoids any "marketing" or filler language.
        
        Opportunities Summary:
        ${top3.map(o => `- ${o.symbol}: ${o.strategy} | Strike $${o.strike} | Expiry ${o.expiration} | Yield ${o.annualizedYield}%`).join("\n")}
        
        Tone: Institutional research note. Cold, objective, data-driven. NO PREAMBLE headers like "To: Investment Committee". Start directly with the technical thesis.`;

        const modelWithTools = getGenerativeModel("gemini-3-flash-preview", [{ googleSearch: {} }]);
        const synResult = await modelWithTools.generateContent(synopsisPrompt);
        const synResponse = await synResult.response;
        const synText = synResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        if (synText) {
            // Strip markdown headers if AI ignores instruction, ensuring clean text for UI
            synopsis = synText.replace(/^#+\s/gm, "").replace(/\*\*/g, "").trim();
            console.log(`Collective Synopsis: ${synopsis.slice(0, 50)}...`);
        }
    } catch (error) {
        console.error("Failed to generate synopsis:", error);
    }

    return synopsis;
};
