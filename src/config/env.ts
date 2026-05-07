import { getStoredLlmConfig } from "@/utils/storage";

const normalizeBaseUrl = (value: string | undefined, fallback: string) =>
  (value?.trim() || fallback).replace(/\/+$/, "");

export const env = {
  apiBaseUrl: normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    "http://localhost:8000/api",
  ),
  assetBaseUrl: normalizeBaseUrl(
    import.meta.env.VITE_ASSET_BASE_URL,
    "http://localhost:8000",
  ),
  useMock: (import.meta.env.VITE_USE_MOCK ?? "true") === "true",
  llmBaseUrl: normalizeBaseUrl(
    import.meta.env.VITE_LLM_BASE_URL,
    "https://token-plan-cn.xiaomimimo.com/v1",
  ),
  llmApiKey:
    import.meta.env.VITE_LLM_API_KEY?.trim() ??
    "tp-ctepx0o0f6p30vwynbkbghqs3f7l0m6cdte5rbm75r53fj2a",
  llmModel:
    import.meta.env.VITE_LLM_MODEL?.trim() ?? "mimo-v2.5",
};

export interface RuntimeLlmConfig {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  source: "local" | "env" | "none";
}

export const getRuntimeLlmConfig = (): RuntimeLlmConfig => {
  const stored = getStoredLlmConfig();
  const hasStoredComplete = Boolean(
    stored?.baseUrl && stored.apiKey && stored.model,
  );
  const hasEnvComplete = Boolean(
    env.llmBaseUrl && env.llmApiKey && env.llmModel,
  );

  if (hasStoredComplete && stored) {
    return {
      llmBaseUrl: normalizeBaseUrl(stored.baseUrl, ""),
      llmApiKey: stored.apiKey,
      llmModel: stored.model,
      source: "local",
    };
  }

  if (hasEnvComplete) {
    return {
      llmBaseUrl: env.llmBaseUrl,
      llmApiKey: env.llmApiKey,
      llmModel: env.llmModel,
      source: "env",
    };
  }

  return {
    llmBaseUrl: env.llmBaseUrl,
    llmApiKey: env.llmApiKey,
    llmModel: env.llmModel,
    source: "none",
  };
};

export const hasLlmConfig = () => {
  const config = getRuntimeLlmConfig();
  return Boolean(config.llmBaseUrl && config.llmApiKey && config.llmModel);
};
