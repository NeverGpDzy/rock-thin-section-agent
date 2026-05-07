import type { AgentMessage } from "@/types/agent";

const AUTH_KEY = "rock-agent-auth";
const AGENT_PREFIX = "rock-agent-chat";
const LLM_CONFIG_KEY = "rock-agent-llm-config";

export type ConversationScope = number | "general";

export interface StoredAuthState {
  token: string | null;
}

export interface StoredLlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const safeGetItem = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
};

const safeSetItem = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
};

const safeRemoveItem = (key: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
};

export const getStoredAuth = (): StoredAuthState => {
  const raw = safeGetItem(AUTH_KEY);

  if (!raw) {
    return { token: null };
  }

  try {
    return JSON.parse(raw) as StoredAuthState;
  } catch {
    return { token: null };
  }
};

export const saveStoredAuth = (value: StoredAuthState) => {
  safeSetItem(AUTH_KEY, JSON.stringify(value));
};

export const clearStoredAuth = () => {
  safeRemoveItem(AUTH_KEY);
};

export const getAuthToken = () => getStoredAuth().token;

export const getConversationStorageKey = (scope: ConversationScope) =>
  `${AGENT_PREFIX}:${String(scope)}`;

export const loadConversation = (scope: ConversationScope): AgentMessage[] => {
  const raw = safeGetItem(getConversationStorageKey(scope));

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as AgentMessage[];
  } catch {
    return [];
  }
};

export const saveConversation = (
  scope: ConversationScope,
  messages: AgentMessage[],
) => {
  safeSetItem(getConversationStorageKey(scope), JSON.stringify(messages));
};

export const clearConversation = (scope: ConversationScope) => {
  safeRemoveItem(getConversationStorageKey(scope));
};

export const getStoredLlmConfig = (): StoredLlmConfig | null => {
  const raw = safeGetItem(LLM_CONFIG_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredLlmConfig>;

    return {
      baseUrl: parsed.baseUrl?.trim() ?? "",
      apiKey: parsed.apiKey?.trim() ?? "",
      model: parsed.model?.trim() ?? "",
    };
  } catch {
    return null;
  }
};

export const saveStoredLlmConfig = (value: StoredLlmConfig) => {
  safeSetItem(
    LLM_CONFIG_KEY,
    JSON.stringify({
      baseUrl: value.baseUrl.trim(),
      apiKey: value.apiKey.trim(),
      model: value.model.trim(),
    }),
  );
};

export const clearStoredLlmConfig = () => {
  safeRemoveItem(LLM_CONFIG_KEY);
};
