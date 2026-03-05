import OpenAI from "openai";

// OpenAI client config used by API routes/services for GPT-based scheduling.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const MODEL = "gpt-4o";

export default client;
