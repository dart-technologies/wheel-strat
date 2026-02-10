import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";

let vertexAIInstance: VertexAI | null = null;
let googleAIInstance: GoogleGenerativeAI | null = null;

export const getVertexAI = () => {
    if (!vertexAIInstance) {
        const project = process.env.GCLOUD_PROJECT ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            "wheel-strat";

        vertexAIInstance = new VertexAI({
            project,
            location: 'global',
            apiEndpoint: 'aiplatform.googleapis.com'
        });

        console.log(`VertexAI Initialized: Project=${project}, Location=global, Endpoint=aiplatform.googleapis.com`);
    }
    return vertexAIInstance;
};

export const getGoogleAI = (apiKey: string) => {
    if (!googleAIInstance) {
        googleAIInstance = new GoogleGenerativeAI(apiKey);
        console.log(`GoogleAI Studio Initialized`);
    }
    return googleAIInstance;
};

export const getGenerativeModel = (modelName: string = "gemini-3-flash-preview", tools?: any[]) => {
    const provider = process.env.AI_PROVIDER || 'vertex_ai';
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    // Google AI Studio Path
    if (provider === 'google_ai_studio' && apiKey) {
        console.log(`Using Google AI Studio provider with model: ${modelName}`);
        const genAI = getGoogleAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            // Google AI Studio tools format might differ slightly, but passing as is for now or ignoring if complex
            // For hackathon content generation, tools might not be strictly needed or need adaptation.
            // Converting Vertex tools to Gemini tools if necessary.
        });

        // Wrap to match expected interface if possible, or return as is and handle in consumer
        return {
            provider: 'google_ai_studio',
            generateContent: async (prompt: string) => {
                const result = await model.generateContent(prompt);
                return {
                    response: result.response,
                    // Helper to unify text access
                    text: () => result.response.text()
                };
            }
        };
    }

    // Fallback to Vertex AI
    if (provider === 'google_ai_studio') {
        console.warn("AI_PROVIDER is 'google_ai_studio' but no API Key found. Falling back to Vertex AI.");
    }

    console.log(`Using Vertex AI provider with model: ${modelName}`);
    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({
        model: modelName,
        tools: tools,
    });

    return {
        provider: 'vertex_ai',
        generateContent: async (prompt: string) => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return {
                response: response,
                // Helper to unify text access
                text: () => response.candidates?.[0]?.content?.parts?.[0]?.text || ""
            };
        }
    };
};
