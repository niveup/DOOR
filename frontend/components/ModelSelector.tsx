"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AiProviderName = "openrouter" | "nvidia" | "cerebras";

export interface AiSelection {
  provider: AiProviderName;
  model: string;
}

interface ProviderConfiguration {
  provider: AiProviderName;
  configured: boolean;
  model: string;
  isActive: boolean;
}

interface AiConfigurationResponse {
  activeProvider: AiProviderName | null;
  activeModel: string | null;
  providers: ProviderConfiguration[];
}

const fallbackModels: Record<AiProviderName, string> = {
  openrouter: "openrouter/free",
  nvidia: "meta/llama-3.1-8b-instruct",
  cerebras: "gemma-4-31b",
};

export function ModelSelector({
  value,
  onChange,
  className = "",
}: {
  value: AiSelection;
  onChange: (selection: AiSelection) => void;
  className?: string;
}) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [providers, setProviders] = useState<ProviderConfiguration[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadModels = useCallback(async (provider: AiProviderName, selectedModel: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/ai/models?provider=${provider}`, {
        headers: {},
      });
      const result = await response.json();
      const nextModels = Array.isArray(result.models) ? result.models : [];
      setModels([...new Set([selectedModel, ...nextModels].filter(Boolean))]);
    } catch {
      setModels([selectedModel]);
    }
  }, [backendUrl]);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/ai/config`, {
        headers: {},
      });
      const result = await response.json() as AiConfigurationResponse;
      if (!response.ok) throw new Error("AI configuration unavailable.");

      const activeProvider = result.activeProvider || value.provider;
      const activeConfiguration = result.providers.find((item) => item.provider === activeProvider);
      const nextSelection = {
        provider: activeProvider,
        model: activeConfiguration?.model || result.activeModel || fallbackModels[activeProvider],
      };
      setProviders(result.providers.filter((item) => item.configured));
      onChange(nextSelection);
      await loadModels(nextSelection.provider, nextSelection.model);
    } catch {
      setProviders([
        { provider: value.provider, configured: true, model: value.model, isActive: true },
      ]);
      setModels([value.model]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, loadModels, onChange, value.model, value.provider]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void initialize();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialize]);

  const availableModels = useMemo(
    () => [...new Set([value.model, ...models].filter(Boolean))],
    [models, value.model]
  );

  const changeProvider = (provider: AiProviderName) => {
    const providerConfiguration = providers.find((item) => item.provider === provider);
    const model = providerConfiguration?.model || fallbackModels[provider];
    onChange({ provider, model });
    setLoading(true);
    void loadModels(provider, model).finally(() => setLoading(false));
  };

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <select
        aria-label="AI provider"
        value={value.provider}
        onChange={(event) => changeProvider(event.target.value as AiProviderName)}
        disabled={loading}
        className="focus-ring h-8 shrink-0 rounded-md border border-[var(--border)] bg-white px-2 text-[10px] font-semibold text-[var(--text-primary)] disabled:opacity-50"
      >
        {(providers.length ? providers : [
          { provider: "openrouter" as const, configured: true, model: fallbackModels.openrouter, isActive: false },
          { provider: "nvidia" as const, configured: true, model: fallbackModels.nvidia, isActive: false },
          { provider: "cerebras" as const, configured: true, model: fallbackModels.cerebras, isActive: false },
        ]).map((item) => (
          <option key={item.provider} value={item.provider}>
            {item.provider === "openrouter" ? "OpenRouter" : item.provider === "cerebras" ? "Cerebras" : "NVIDIA"}
          </option>
        ))}
      </select>
      <select
        aria-label="AI model"
        value={value.model}
        onChange={(event) => onChange({ ...value, model: event.target.value })}
        disabled={loading}
        title={value.model}
        className="focus-ring h-8 min-w-0 max-w-[220px] rounded-md border border-[var(--border)] bg-white px-2 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
      >
        {availableModels.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
    </div>
  );
}
