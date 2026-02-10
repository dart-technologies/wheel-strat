// Load shared env helper from scripts/lib.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadEnv } = require('./lib/env');
loadEnv();

// Force provider to verify switch logic, if not set in env
if (!process.env.AI_PROVIDER) {
    console.log("Setting AI_PROVIDER=google_ai_studio for smoke test");
    process.env.AI_PROVIDER = 'google_ai_studio';
}

import { getGenerativeModel } from '../src/lib/vertexai';

async function runSmokeTest() {
    console.log("--- Starting Smoke Test ---");
    console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER}`);
    console.log(`GOOGLE_API_KEY Present: ${!!process.env.GOOGLE_API_KEY}`);

    try {
        const model = getGenerativeModel('gemini-3-flash-preview');
        // Check internal provider property if exposed, or infer from logs
        console.log("Model requested. Generating content...");

        const result = await model.generateContent("Explain what 'smoke test' means in software in one sentence.");
        const text = result.text();

        console.log("\n--- Response Received ---");
        console.log(text);
        console.log("--- Smoke Test Complete ---");

        if (text && text.length > 0) {
            console.log("✅ SUCCESS");
            process.exit(0);
        } else {
            console.error("❌ FAILED: Empty response");
            process.exit(1);
        }

    } catch (e: any) {
        console.error("❌ ERROR:", e);
        process.exit(1);
    }
}

runSmokeTest();
