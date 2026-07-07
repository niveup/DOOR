import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.AI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

async function run() {
  console.log("Querying google/diffusiongemma-26b-a4b-it for 'what is thermodynamics'...");
  
  const systemPrompt = `You are a strict JSON responder. You must return ONLY a valid JSON object.
Schema:
{ "concept": "string", "summary": "string" }`;

  try {
    const params: any = {
      model: "google/diffusiongemma-26b-a4b-it",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Explain what is thermodynamics" }
      ],
      temperature: 1.0,
      max_tokens: 1024,
      chat_template_kwargs: { enable_thinking: true }
    };

    const response = await client.chat.completions.create(params);
    
    console.log("RAW CONTENT:");
    console.log(response.choices[0]?.message?.content);
  } catch (error: any) {
    console.error("FAILED:", error.message);
  }
}

run();
