import { defineString } from "firebase-functions/params";
import { getIbkrConfig } from "@wheel-strat/shared";
import { isFunctionsEmulator } from "./runtime";

const BRIDGE_URL_PROFILE_SENTINEL = "__profile__";
const ibkrBridgeUrlParam = defineString("IBKR_BRIDGE_URL", { default: BRIDGE_URL_PROFILE_SENTINEL });
const ibkrBridgeApiKeyParam = defineString("IBKR_BRIDGE_API_KEY", { default: "" });
const ibkrTradingModeParam = defineString("IB_TRADING_MODE", { default: "paper" });
const LOCALHOST_BRIDGE_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i;

export function getIbkrFunctionsConfig() {
    const bridgeUrlParam = ibkrBridgeUrlParam.value();
    const bridgeUrlEnv = bridgeUrlParam && bridgeUrlParam !== BRIDGE_URL_PROFILE_SENTINEL
        ? { IBKR_BRIDGE_URL: bridgeUrlParam }
        : {};
    const config = getIbkrConfig({
        ...process.env,
        ...bridgeUrlEnv,
        IBKR_BRIDGE_API_KEY: ibkrBridgeApiKeyParam.value(),
        IB_TRADING_MODE: ibkrTradingModeParam.value(),
    });
    if (!isFunctionsEmulator() && LOCALHOST_BRIDGE_RE.test(config.bridgeUrl)) {
        console.warn("[ibkrRuntime] IBKR_BRIDGE_URL points to localhost in production; set a public bridge URL.");
    }
    return config;
}
