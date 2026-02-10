import * as logger from "firebase-functions/logger";
import { Logging } from "@google-cloud/logging";

const LOG_SCAN_WINDOW_HOURS = 1;

export async function scanErrorLogs() {
    try {
        const logging = new Logging();
        const oneHourAgo = new Date(Date.now() - LOG_SCAN_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        const filter = `severity >= ERROR AND timestamp >= "${oneHourAgo}" AND NOT textPayload:"System Health Check Complete"`;

        const [entries] = await logging.getEntries({
            filter,
            pageSize: 10
        });

        return entries.map(e => ({
            timestamp: e.metadata.timestamp,
            message: e.data?.message || e.metadata.textPayload || "Unknown error",
            resource: e.metadata.resource?.labels?.function_name || "system"
        }));
    } catch (error) {
        logger.error("Log scanning failed", error);
        return [];
    }
}
