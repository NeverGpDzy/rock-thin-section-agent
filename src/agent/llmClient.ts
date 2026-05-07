import axios from "axios";
import { getRuntimeLlmConfig, hasLlmConfig } from "@/config/env";
import type { MessageContent } from "@/types/agent";

export interface ChatCompletionToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  tool_call_id?: string;
  tool_calls?: ChatCompletionToolCall[];
}

export interface StreamResult {
  text: string;
  toolCalls: ChatCompletionToolCall[];
}

export interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: ChatCompletionToolCall[];
    };
  }>;
  error?: { message?: string };
}

const ensureLlmConfig = () => {
  if (!hasLlmConfig()) {
    throw new Error(
      "当前未配置大模型接口，请先在设置中配置 VITE_LLM_BASE_URL、VITE_LLM_API_KEY 和 VITE_LLM_MODEL。",
    );
  }

  return getRuntimeLlmConfig();
};

const getEndpointCandidates = (baseUrl: string) => {
  const normalized = baseUrl.replace(/\/+$/, "");

  if (normalized.endsWith("/chat/completions")) {
    return [normalized];
  }

  if (normalized.endsWith("/v1")) {
    return [`${normalized}/chat/completions`];
  }

  return [...new Set([`${normalized}/chat/completions`, `${normalized}/v1/chat/completions`])];
};

const buildHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "api-key": apiKey,
  "Content-Type": "application/json",
});

const buildPayload = ({
  model,
  messages,
  tools,
  temperature = 0.2,
  stream = false,
}: {
  model: string;
  messages: ChatCompletionMessage[];
  tools?: ChatCompletionTool[];
  temperature?: number;
  stream?: boolean;
}) => {
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  return payload;
};

const parseAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;

    return (
      data?.error?.message ||
      data?.message ||
      error.message ||
      "模型接口请求失败。"
    );
  }

  return error instanceof Error ? error.message : "模型接口请求失败。";
};

const parseFetchError = async (response: Response) => {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };

    return body?.error?.message || body?.message || response.statusText;
  } catch {
    return response.statusText;
  }
};

export const createChatCompletion = async ({
  messages,
  tools,
  temperature,
}: {
  messages: ChatCompletionMessage[];
  tools?: ChatCompletionTool[];
  temperature?: number;
}): Promise<ChatCompletionResponse> => {
  const config = ensureLlmConfig();
  const candidates = getEndpointCandidates(config.llmBaseUrl);
  let lastError = "模型接口请求失败。";

  for (const endpoint of candidates) {
    try {
      const response = await axios.post<ChatCompletionResponse>(
        endpoint,
        buildPayload({
          model: config.llmModel,
          messages,
          tools,
          temperature,
          stream: false,
        }),
        {
          headers: buildHeaders(config.llmApiKey),
          timeout: 60_000,
        },
      );

      return response.data;
    } catch (error) {
      lastError = parseAxiosError(error);
    }
  }

  throw new Error(lastError);
};

export const streamChatCompletion = async ({
  messages,
  tools,
  temperature,
  onChunk,
  signal,
}: {
  messages: ChatCompletionMessage[];
  tools?: ChatCompletionTool[];
  temperature?: number;
  onChunk?: (chunk: string, fullText: string) => void;
  signal?: AbortSignal;
}): Promise<StreamResult> => {
  const config = ensureLlmConfig();
  const candidates = getEndpointCandidates(config.llmBaseUrl);
  let lastError = "模型接口请求失败。";

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(config.llmApiKey),
        body: JSON.stringify(
          buildPayload({
            model: config.llmModel,
            messages,
            tools,
            temperature,
            stream: true,
          }),
        ),
        signal,
      });

      if (!response.ok) {
        lastError = await parseFetchError(response);
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        return streamFromJson(response, onChunk);
      }

      return streamFromSSE(response, onChunk);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      lastError =
        error instanceof Error ? error.message : "模型接口请求失败。";
    }
  }

  throw new Error(lastError);
};

const streamFromJson = async (
  response: Response,
  onChunk?: (chunk: string, fullText: string) => void,
): Promise<StreamResult> => {
  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content ?? "";
  const toolCalls = body.choices?.[0]?.message?.tool_calls ?? [];
  onChunk?.(content, content);
  return { text: content, toolCalls };
};

const streamFromSSE = async (
  response: Response,
  onChunk?: (chunk: string, fullText: string) => void,
): Promise<StreamResult> => {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("无法读取流式响应。");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  // Accumulate tool calls by index — SSE delivers name/arguments incrementally
  const toolCallAccumulator: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map();

  interface SSEToolCallDelta {
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }

  const processLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      return;
    }

    const data = trimmed.slice(5).trim();

    if (!data || data === "[DONE]") {
      return;
    }

    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: SSEToolCallDelta[];
          };
          message?: {
            content?: string | null;
            tool_calls?: ChatCompletionToolCall[];
          };
        }>;
      };

      const choice = parsed.choices?.[0];

      // Text content (streaming delta or non-streaming message)
      const textDelta =
        choice?.delta?.content ??
        choice?.delta?.reasoning_content ??
        choice?.message?.content;

      if (textDelta) {
        fullText += textDelta;
        onChunk?.(textDelta, fullText);
      }

      // Tool calls from streaming delta
      const deltaToolCalls = choice?.delta?.tool_calls;
      if (deltaToolCalls) {
        for (const tc of deltaToolCalls) {
          const existing = toolCallAccumulator.get(tc.index);
          if (existing) {
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          } else {
            toolCallAccumulator.set(tc.index, {
              id: tc.id ?? `call_${tc.index}`,
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            });
          }
        }
      }

      // Tool calls from non-streaming message (JSON response)
      const messageToolCalls = choice?.message?.tool_calls;
      if (messageToolCalls) {
        for (const tc of messageToolCalls) {
          toolCallAccumulator.set(tc.id ? toolCallAccumulator.size : 0, {
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
      }
    } catch {
      // skip malformed SSE chunks
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        processLine(line);
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      processLine(line);
    }
  }

  const toolCalls: ChatCompletionToolCall[] = [];
  for (const [, acc] of toolCallAccumulator) {
    if (acc.name) {
      toolCalls.push({
        id: acc.id,
        type: "function",
        function: {
          name: acc.name,
          arguments: acc.arguments,
        },
      });
    }
  }

  return { text: fullText, toolCalls };
};
