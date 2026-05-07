import type { AgentMessage } from "@/types/agent";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/memory/storage";

const SUMMARY_PREFIX = "rock-agent-memory-summary";
const MAX_SUMMARY_LENGTH = 2000;
const SUMMARIZE_THRESHOLD = 20;

export const getConversationSummaryKey = (scope: string) =>
  `${SUMMARY_PREFIX}:${scope}`;

export const getConversationSummary = (scope: string): string | null => {
  const raw = safeGetItem(getConversationSummaryKey(scope));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { summary: string; timestamp: number };
    return parsed.summary || null;
  } catch {
    return null;
  }
};

export const saveConversationSummary = (scope: string, summary: string) => {
  const truncated =
    summary.length > MAX_SUMMARY_LENGTH
      ? summary.slice(0, MAX_SUMMARY_LENGTH) + "..."
      : summary;

  safeSetItem(
    getConversationSummaryKey(scope),
    JSON.stringify({ summary: truncated, timestamp: Date.now() }),
  );
};

export const clearConversationSummary = (scope: string) => {
  safeRemoveItem(getConversationSummaryKey(scope));
};

export const shouldSummarize = (messages: AgentMessage[]): boolean => {
  const realMessages = messages.filter((m) => m.kind !== "status");
  return realMessages.length >= SUMMARIZE_THRESHOLD;
};

export const buildSummarizationPrompt = (
  messages: AgentMessage[],
): string => {
  const realMessages = messages.filter((m) => m.kind !== "status");
  const recentMessages = realMessages.slice(-SUMMARIZE_THRESHOLD);

  const conversationText = recentMessages
    .map((m) => {
      const role = m.role === "user" ? "用户" : "助手";
      return `[${role}]: ${m.content}`;
    })
    .join("\n");

  return `请将以下对话内容总结为一段简洁的摘要，保留关键信息（如分析过的图片、得到的结论、用户的关注点等）。摘要不超过500字。

对话内容：
${conversationText}`;
};
