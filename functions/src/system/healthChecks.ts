import { buildBridgeUrl } from "@wheel-strat/shared";
import { fetchWithTimeout } from "@/lib/fetch";
import { requireIbkrBridge } from "@/lib/ibkrGuards";
import { getDB, isDbConfigured } from "@/lib/cloudsql";
import { getGenerativeModel } from "@/lib/vertexai";
import { ibkrHealthSchema, parseIbkrResponse } from "@/lib/ibkrSchemas";
import type { ServiceStatus } from "./healthTypes";

export async function checkBridgeHealth(): Promise<ServiceStatus> {
    try {
        const { bridgeUrl, bridgeApiKey } = requireIbkrBridge();
        const res = await fetchWithTimeout(buildBridgeUrl(bridgeUrl, "/health"), {}, 5000, bridgeApiKey);
        const rawData = await res.json();
        const data = parseIbkrResponse(ibkrHealthSchema, rawData, "health");

        return {
            status: (res.ok && data?.connected) ? "ok" : "error",
            message: (res.ok && data?.connected)
                ? "Connected to IBKR"
                : `Bridge Error: ${res.status} / Connected: ${data?.connected}`,
            details: data
        };
    } catch (error: any) {
        return { status: "error", message: error.message };
    }
}

export async function checkDatabaseHealth(): Promise<ServiceStatus> {
    if (!isDbConfigured()) {
        return { status: "warning", message: "Database not configured" };
    }

    try {
        const knex = getDB();
        await knex.raw("SELECT 1");
        return { status: "ok", message: "Database connected" };
    } catch (error: any) {
        return { status: "error", message: error.message };
    }
}

export async function checkGeminiHealth(): Promise<ServiceStatus> {
    try {
        const model = getGenerativeModel("gemini-3-flash-preview");
        const geminiRes = await model.generateContent("ping");
        const response = await geminiRes.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        return {
            status: text ? "ok" : "error",
            message: text ? "AI Engine Responsive" : "AI Engine No Response"
        };
    } catch (error: any) {
        return { status: "error", message: error.message };
    }
}
