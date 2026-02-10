import { HttpsError } from "firebase-functions/v2/https";
import { getIbkrFunctionsConfig } from "./ibkrRuntime";
import { isFunctionsEmulator } from "./runtime";

export const IBKR_BRIDGE_NOT_CONFIGURED = "IBKR_BRIDGE_URL not configured";

export type IbkrBridgeContext = ReturnType<typeof getIbkrFunctionsConfig> & {
    isEmulator: boolean;
};

export function requireIbkrBridge(options: { requireConfigured?: boolean; context?: string } = {}): IbkrBridgeContext {
    const config = getIbkrFunctionsConfig();
    const isEmulator = isFunctionsEmulator();
    const requireConfigured = Boolean(options.requireConfigured);

    if (requireConfigured && !isEmulator && !config.bridgeUrlConfigured) {
        throw new HttpsError("failed-precondition", IBKR_BRIDGE_NOT_CONFIGURED);
    }

    if (!requireConfigured && options.context && !isEmulator && !config.bridgeUrlConfigured) {
        console.warn(`[${options.context}] ${IBKR_BRIDGE_NOT_CONFIGURED}`);
    }

    return { ...config, isEmulator };
}
