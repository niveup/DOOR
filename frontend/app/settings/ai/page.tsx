"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
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
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  const [configuration, setConfiguration] = useState<AiConfiguration | null>(null);
  const [provider, setProvider] = useState<ProviderName>("openrouter");
  const [model, setModel] = useState("openrouter/free");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const currentTheme = (document.documentElement.dataset.theme as "light" | "dark") || "light";
    setTheme(currentTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("jujum-theme", nextTheme);
  };

  useEffect(() => {
    if (!mounted) return;

    const syncTheme = () => {
      const currentTheme = (document.documentElement.dataset.theme as "light" | "dark") || "light";
      setTheme(currentTheme);
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          syncTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [mounted]);

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
            <div className="relative inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
              {(["openrouter", "nvidia", "cerebras"] as ProviderName[]).map((item) => {
                const isSelected = provider === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => chooseProvider(item)}
                    className={`focus-ring relative z-10 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors duration-200 ${
                      isSelected
                        ? "text-[var(--accent)] font-bold"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeProviderTab"
                        className="absolute inset-0 rounded-md bg-white shadow-sm -z-10 pointer-events-none"
                        transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                        style={{ willChange: "transform, opacity" }}
                      />
                    )}
                    {providerLabels[item]}
                  </button>
                );
              })}
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

        <PageSection title="Appearance" eyebrow="Theme preference">
          <div className="surface p-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Toggle color theme manually.</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-secondary w-full py-1.5 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                {!mounted || theme === "light" ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                    <span>Dark Theme</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.95 4.95l1.59 1.59m10.91 10.91l1.59 1.59M3 12h2.25m13.5 0H21m-2.23-7.28l-1.59 1.59m-10.91 10.91l-1.59 1.59M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
                    </svg>
                    <span>Light Theme</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
