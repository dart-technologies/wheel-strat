import * as logger from "firebase-functions/logger";
import { getGenerativeModel } from "@/lib/vertexai";

export async function analyzeIssuesWithAI(services: any, logs: any[]) {
    try {
        const model = getGenerativeModel("gemini-3-flash-preview");
        const prompt = `
        Analyze the following system health data and provide a concise summary (max 200 chars) and recommended resolution steps.

        Service Status:
        ${JSON.stringify(services, null, 2)}

        Recent Error Logs:
        ${JSON.stringify(logs, null, 2)}

        Output as JSON:
        {
          "summary": "High level situation",
          "resolution": "Specific steps to fix"
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Gemini");

        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
    } catch (error) {
        logger.error("AI Health Analysis failed", error);
        return { summary: "Failed to generate AI summary", resolution: "Manual investigation required" };
    }
}
