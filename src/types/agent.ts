import type {
  ClassificationResult,
  ImageDetailResponse,
  SegmentationResult,
} from "@/types/image";

export type AgentIntent = "overview" | "classification" | "segmentation";
export type AgentMessageKind = "message" | "status";

export type AgentToolName =
  | "get_image_detail"
  | "classify_mineral"
  | "segment_oooids"
  | "search_knowledge";

export interface AgentToolCall {
  id: string;
  name: AgentToolName;
  args: Record<string, unknown>;
  status: "success" | "error";
  resultSummary: string;
  errorMessage?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  kind?: AgentMessageKind;
  status?: "streaming" | "done" | "error";
  toolCalls?: AgentToolCall[];
  snapshot?: ImageDetailResponse | null;
}

export interface AgentProgressEvent {
  stage:
    | "intent"
    | "mode"
    | "tool"
    | "summary"
    | "response"
    | "error";
  message: string;
}

export interface AgentTurnResult {
  reply: string;
  toolCalls: AgentToolCall[];
  snapshot: ImageDetailResponse | null;
}

export interface AgentToolExecutionContext {
  imageId?: number | null;
}

export interface AgentStructuredSummary {
  classification: ClassificationResult | null;
  segmentation: SegmentationResult | null;
  detail: ImageDetailResponse | null;
}

// --- Multimodal content types for LLM messages ---

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ImageUrlContentBlock {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type MessageContent = string | Array<TextContentBlock | ImageUrlContentBlock>;
