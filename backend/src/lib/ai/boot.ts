import type { PrismaClient } from "@prisma/client";
import { encryptApiKey, decryptApiKey } from "./credentials";
import type { AiProviderName } from "./provider";

/**
 * AI credential bootstrapping, extracted from server.ts (audit GA-114 step 4).
 * Seeds provider credentials from environment on first use and resolves the
 * active configuration for chat dispatch. Single-process latch semantics are
 * unchanged: one initialization per server lifetime.
 */
export const aiProviderDefaults: Record<AiProviderName, string> = {
  openrouter: "openrouter/free",
  nvidia: "meta/llama-3.1-8b-instruct",
  cerebras: "gemma-4-31b",
};

let aiCredentialsInitialized = false;

export function environmentApiKey(provider: AiProviderName): string {
  if (provider === "nvidia") return process.env.NVIDIA_API_KEY || "";
  if (provider === "cerebras") return process.env.CEREBRAS_API_KEY || "";
  return process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "";
}

export function environmentModel(provider: AiProviderName): string {
  if (provider === "openrouter") return process.env.AI_MODEL || aiProviderDefaults.openrouter;
  if (provider === "cerebras") return aiProviderDefaults.cerebras;
  return aiProviderDefaults.nvidia;
}

export async function initializeAiCredentials(prisma: PrismaClient): Promise<void> {
  if (aiCredentialsInitialized) return;

  const existing = await prisma.aiProviderCredential.findMany();
  const existingProviders = new Set(existing.map((credential) => credential.provider));
  const preferredProvider: AiProviderName =
    process.env.AI_PROVIDER === "nvidia"
      ? "nvidia"
      : process.env.AI_PROVIDER === "cerebras"
        ? "cerebras"
        : "openrouter";

  for (const provider of ["openrouter", "nvidia", "cerebras"] as AiProviderName[]) {
    const apiKey = environmentApiKey(provider);
    if (!apiKey || existingProviders.has(provider)) continue;

    const encrypted = encryptApiKey(apiKey);
    await prisma.aiProviderCredential.upsert({
      where: { provider },
      update: {},
      create: {
        provider,
        ...encrypted,
        model: environmentModel(provider),
        isActive: provider === preferredProvider && !existing.some((credential) => credential.isActive),
      },
    });
  }

  const activeCredential = await prisma.aiProviderCredential.findFirst({ where: { isActive: true } });
  if (!activeCredential) {
    const preferredCredential = await prisma.aiProviderCredential.findUnique({ where: { provider: preferredProvider } });
    const fallbackCredential = preferredCredential || await prisma.aiProviderCredential.findFirst();
    if (fallbackCredential) {
      await prisma.aiProviderCredential.update({
        where: { provider: fallbackCredential.provider },
        data: { isActive: true },
      });
    }
  }

  aiCredentialsInitialized = true;
}

export function isAiProviderName(value: unknown): value is AiProviderName {
  return value === "openrouter" || value === "nvidia" || value === "cerebras";
}

export async function resolveAiConfiguration(prisma: PrismaClient, providerOverride?: AiProviderName) {
  await initializeAiCredentials(prisma);
  const credential = providerOverride
    ? await prisma.aiProviderCredential.findUnique({ where: { provider: providerOverride } })
    : await prisma.aiProviderCredential.findFirst({ where: { isActive: true } });

  if (!credential || !isAiProviderName(credential.provider)) {
    throw new Error("AI is not configured. Add an OpenRouter, NVIDIA, or Cerebras key in AI Control.");
  }

  return {
    provider: credential.provider,
    model: credential.model,
    apiKey: decryptApiKey(credential),
  };
}
