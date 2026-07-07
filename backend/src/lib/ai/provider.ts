import { OpenAI } from "openai";

export type AiProviderName = "openrouter" | "nvidia" | "cerebras";

export interface AiProvider {
  chat(systemPrompt: string, userPrompt: string, modelOverride?: string, imageUrl?: string): Promise<string>;
}

export class OpenAICompatibleProvider implements AiProvider {
  private client: OpenAI;
  private providerName: string;
  private defaultModel: string;

  constructor(options: { provider: AiProviderName; apiKey: string; model: string }) {
    if (options.provider === "nvidia") {
      this.providerName = "NVIDIA";
    } else if (options.provider === "cerebras") {
      this.providerName = "Cerebras";
    } else {
      this.providerName = "OpenRouter";
    }
    this.defaultModel = options.model;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.provider === "nvidia"
        ? "https://integrate.api.nvidia.com/v1"
        : options.provider === "cerebras"
          ? "https://api.cerebras.ai/v1"
          : "https://openrouter.ai/api/v1",
      timeout: 90_000,
      maxRetries: 1,
    });
  }

  async chat(systemPrompt: string, userPrompt: string, modelOverride?: string, imageUrl?: string): Promise<string> {
    const activeModel = modelOverride || this.defaultModel;
    let userContent: any = userPrompt;

    if (imageUrl) {
      userContent = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
    }

    const params: any = {
      model: activeModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.35,
      max_tokens: 4096,
    };

    if (activeModel === "google/diffusiongemma-26b-a4b-it") {
      params.chat_template_kwargs = { enable_thinking: true };
    }

    try {
      console.log(`[AI Call] ${this.providerName} / ${activeModel}${imageUrl ? " / image" : ""}`);
      const response = await this.client.chat.completions.create(params);
      return response.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.error("AI API Call Error:", error);
      const status = error?.status ? ` (${error.status})` : "";
      throw new Error(`${this.providerName} request failed${status}: ${error.message}`);
    }
  }
}

export function createAiProvider(options: { provider: AiProviderName; apiKey: string; model: string }): AiProvider {
  if (!options.apiKey) {
    const displayName = options.provider === "nvidia" ? "NVIDIA" : options.provider === "cerebras" ? "Cerebras" : "OpenRouter";
    throw new Error(`${displayName} API key is not configured.`);
  }
  return new OpenAICompatibleProvider(options);
}
