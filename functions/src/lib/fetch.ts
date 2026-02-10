import { fetchBridgeWithTimeout } from "@wheel-strat/shared";

export type { BridgeFetchResponse as FetchResponse } from "@wheel-strat/shared";

/**
 * Standard fetch with timeout and bridge API key support.
 */
export const fetchWithTimeout = fetchBridgeWithTimeout;
