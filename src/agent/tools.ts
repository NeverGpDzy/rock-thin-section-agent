import {
  ensureClassification,
  ensureSegmentation,
  getImageDetail,
} from "@/api/images";
import type { ChatCompletionTool } from "@/agent/llmClient";
import type {
  AgentToolCall,
  AgentToolExecutionContext,
  AgentToolName,
} from "@/types/agent";
import { formatConfidence, formatPercent } from "@/utils/format";

const imageIdParameters = {
  type: "object",
  properties: {
    image_id: {
      type: "integer",
      description: "系统内图片的 image_id。若未提供则默认使用当前上下文图片。",
    },
  },
  required: ["image_id"],
  additionalProperties: false,
};

export const agentToolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_image_detail",
      description: "获取当前图片的基础信息，以及已有的分类和分割结果。",
      parameters: imageIdParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "classify_mineral",
      description: "调用矿物分类接口，返回矿物名称和置信度。",
      parameters: imageIdParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "segment_oooids",
      description: "调用鲕粒分割接口，返回分割图和统计信息。",
      parameters: imageIdParameters,
    },
  },
];

const resolveImageId = (
  args: Record<string, unknown>,
  context: AgentToolExecutionContext,
) => {
  const raw = args.image_id ?? context.imageId;
  const imageId = Number(raw);

  if (!Number.isFinite(imageId) || imageId <= 0) {
    throw new Error("缺少有效的 image_id。");
  }

  return imageId;
};

const successTrace = (
  name: AgentToolName,
  imageId: number,
  resultSummary: string,
): AgentToolCall => ({
  id: crypto.randomUUID(),
  name,
  args: { image_id: imageId },
  status: "success",
  resultSummary,
});

const errorTrace = (
  name: AgentToolName,
  imageId: number,
  errorMessage: string,
): AgentToolCall => ({
  id: crypto.randomUUID(),
  name,
  args: { image_id: imageId },
  status: "error",
  resultSummary: "工具调用失败。",
  errorMessage,
});

export const executeAgentTool = async (
  name: AgentToolName,
  args: Record<string, unknown>,
  context: AgentToolExecutionContext,
): Promise<{
  payload: unknown;
  trace: AgentToolCall;
}> => {
  try {
    const imageId = resolveImageId(args, context);

    if (name === "get_image_detail") {
      const detail = await getImageDetail(imageId);

      return {
        payload: detail,
        trace: successTrace(
          name,
          imageId,
          `已读取图片 ${detail.image.file_name} 的详情信息。`,
        ),
      };
    }

    if (name === "classify_mineral") {
      const result = await ensureClassification(imageId);

      return {
        payload: result,
        trace: successTrace(
          name,
          imageId,
          result?.status === "success"
            ? `分类结果为 ${result.predicted_class}，置信度 ${formatConfidence(result.confidence)}。`
            : `分类任务当前状态为 ${result?.status ?? "unknown"}。`,
        ),
      };
    }

    const result = await ensureSegmentation(imageId);

    return {
      payload: result,
      trace: successTrace(
        name,
        imageId,
        result?.status === "success"
          ? `分割识别出 ${result.grain_count ?? 0} 个候选颗粒，面积占比 ${formatPercent(result.area_ratio)}。`
          : `分割任务当前状态为 ${result?.status ?? "unknown"}。`,
      ),
    };
  } catch (error) {
    const rawImageId =
      typeof args.image_id === "number" || typeof args.image_id === "string"
        ? Number(args.image_id)
        : null;

    return {
      payload: {
        error: error instanceof Error ? error.message : "工具调用失败",
      },
      trace: errorTrace(
        name,
        Number.isFinite(rawImageId) && rawImageId && rawImageId > 0 ? rawImageId : 0,
        error instanceof Error ? error.message : "工具调用失败。",
      ),
    };
  }
};
