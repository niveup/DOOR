"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { MicroInteractionButton } from "@/components/MotionComponents";

type ProviderName = "openrouter" | "nvidia" | "cerebras";

interface ProviderState {
  provider: ProviderName;
  configured: boolean;
  keyHint: string | null;
  model: string;
  isActive: boolean;
  updatedAt: string | null;
}

interface AiConfiguration {
  activeProvider: ProviderName | null;
  activeModel: string | null;
  providers: ProviderState[];
}

const providerLabels: Record<ProviderName, string> = {
  openrouter: "OpenRouter",
  nvidia: "NVIDIA",
  cerebras: "Cerebras",
};

export default function AiSettingsPage() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [configuration, setConfiguration] = useState<AiConfiguration | null>(null);
  const [provider, setProvider] = useState<ProviderName>("openrouter");
  const [model, setModel] = useState("openrouter/free");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedProvider = useMemo(
    () => configuration?.providers.find((item) => item.provider === provider) || null,
    [configuration, provider]
  );

  const loadModels = useCallback(async (nextProvider: ProviderName) => {
    try {
      const response = await fetch(`${backendUrl}/api/ai/models?provider=${nextProvider}`, {
        headers: {},
      });
      const result = await response.json();
      setModels(Array.isArray(result.models) ? result.models : []);
    } catch {
      setModels([]);
    }
  }, [backendUrl]);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/ai/config`, {
        headers: {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI settings could not be loaded.");

      const nextConfiguration = result as AiConfiguration;
      const activeProvider = nextConfiguration.activeProvider || "openrouter";
      const providerConfig = nextConfiguration.providers.find((item) => item.provider === activeProvider);
      setConfiguration(nextConfiguration);
      setProvider(activeProvider);
      setModel(providerConfig?.model || (activeProvider === "openrouter" ? "openrouter/free" : activeProvider === "cerebras" ? "gemma-4-31b" : "meta/llama-3.1-8b-instruct"));
      await loadModels(activeProvider);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, loadModels]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConfiguration();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConfiguration]);

  const chooseProvider = (nextProvider: ProviderName) => {
    setProvider(nextProvider);
    setTestResult(null);
    const providerConfig = configuration?.providers.find((item) => item.provider === nextProvider);
    setModel(providerConfig?.model || (nextProvider === "openrouter" ? "openrouter/free" : nextProvider === "cerebras" ? "gemma-4-31b" : "meta/llama-3.1-8b-instruct"));
    void loadModels(nextProvider);
  };

  const saveConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const response = await fetch(`${backendUrl}/api/ai/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, model, apiKey: apiKey.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "AI settings could not be saved.");

      setConfiguration(result as AiConfiguration);
      setApiKey("");
      toast.success(`${providerLabels[provider]} is now active`);
      await loadModels(provider);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${backendUrl}/api/ai/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Connection failed.");

      setTestResult({
        success: true,
        message: `Connected in ${(result.latencyMs / 1000).toFixed(1)}s`,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppShell
      eyebrow="Settings"
      title="AI Control"
      subtitle="Choose the provider and model used by plans, journal analysis, and explanations."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PageSection title="Provider" eyebrow="Active connection">
          <form onSubmit={saveConfiguration} className="surface p-4 sm:p-5">
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
              {(["openrouter", "nvidia", "cerebras"] as ProviderName[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => chooseProvider(item)}
                  className={`focus-ring rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                    provider === item
                      ? "bg-white text-[var(--accent)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {providerLabels[item]}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="section-label mb-2 block">API key</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={selectedProvider?.configured ? `Saved key ${selectedProvider.keyHint || ""}` : `Paste ${providerLabels[provider]} key`}
                  autoComplete="off"
                  className="app-input px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="section-label mb-2 block">Model ID</span>
                <input
                  list={`models-${provider}`}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={provider === "openrouter" ? "openrouter/free" : provider === "cerebras" ? "gemma-4-31b" : "meta/llama-3.1-8b-instruct"}
                  className="app-input px-3 py-2.5 text-sm"
                />
                <datalist id={`models-${provider}`}>
                  {models.map((item) => <option key={item} value={item} />)}
                </datalist>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <MicroInteractionButton type="submit" loading={saving || loading} className="btn-primary">
                Save and activate
              </MicroInteractionButton>
              <MicroInteractionButton type="button" onClick={testConnection} loading={testing} className="btn-secondary">
                Test connection
              </MicroInteractionButton>
            </div>
          </form>
        </PageSection>

        <PageSection title="Status" eyebrow="AI system">
          <div className="surface p-4">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Active provider</span>
              <span className="pill pill-blue">
                {configuration?.activeProvider ? providerLabels[configuration.activeProvider] : "Not set"}
              </span>
            </div>
            <div className="py-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">Active model</p>
              <p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">
                {configuration?.activeModel || "Not set"}
              </p>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Credential storage</span>
                <span className="pill pill-green">Encrypted</span>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-5 text-[var(--text-secondary)]">AES-256-GCM / Supabase</p>
            </div>
            {testResult ? (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
                testResult.success
                  ? "border-[var(--success)]/20 bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)]"
              }`}>
                {testResult.message}
              </div>
            ) : null}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
