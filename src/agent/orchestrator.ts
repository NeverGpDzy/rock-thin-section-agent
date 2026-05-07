import { inferAgentIntent } from "@/agent/intents";
import {
  streamChatCompletion,
  type ChatCompletionMessage,
} from "@/agent/llmClient";
import { executeAgentTool } from "@/agent/tools";
import { getImageDetail } from "@/api/images";
import { hasLlmConfig } from "@/config/env";
import {
  getConversationSummary,
  shouldSummarize,
  buildSummarizationPrompt,
  saveConversationSummary,
  getImageMemory,
  saveImageMemory,
  buildImageMemoryContext,
} from "@/memory";
import type {
  AgentIntent,
  AgentMessage,
  AgentProgressEvent,
  AgentToolCall,
  AgentToolName,
  AgentTurnResult,
  MessageContent,
} from "@/types/agent";
import type { ImageDetailResponse } from "@/types/image";
import { formatConfidence, formatDateTime, formatPercent } from "@/utils/format";
import { resolveAssetUrl } from "@/utils/assets";

const GENERAL_CHAT_PROMPT = `
你是"岩石薄片智能分析助手"。
即使当前没有绑定图片，你也可以正常进行中文对话、解释系统能力、回答一般性问题。
只有当用户明确要分析某张图片、识别矿物或进行鲕粒分割时，才需要要求用户上传或选择图片。
如果用户提供了图片，请仔细观察图片内容，描述你看到的岩石薄片特征（颜色、纹理、颗粒形态、矿物分布等）。

回复要求：
1. 使用中文。
2. 表达专业、直接、自然。
3. 适合列表、小结或步骤说明时，使用 Markdown。
4. 不要编造图片分析结果；没有数据时要明确说明缺失。`.trim();

const SUMMARY_PROMPT = `
你是"岩石薄片智能分析助手"，具备岩石薄片图像的视觉分析能力。

分析流程：
1. 如果提供了图片，先仔细观察图片，描述你看到的内容：薄片整体形态、矿物颗粒的颜色与分布、
   鲕粒的形状与大小、纹理特征、透射光/反射光下的表现等。
2. 再结合后端接口返回的结构化数据（矿物分类、鲕粒分割），给出综合分析。
3. 如果图片和数据存在矛盾或值得注意的地方，主动指出。

输出要求：
1. 必须使用 Markdown。
2. 必须包含以下二级标题：
   - ## 任务结论
   - ## 图片概况
   - ## 视觉描述（如果提供了图片）
   - ## 矿物分类结果
   - ## 鲕粒分割结果
   - ## 综合分析与建议
3. 视觉描述部分要基于图片内容，描述你实际看到的特征，不要编造。
4. 每个小节至少写 2 条要点，整体形成一份简短但完整的小报告。
5. 如果某项任务未完成、失败或没有结果，要明确写出当前状态、错误信息或缺失原因。
6. 如果用户问题聚焦某一个子任务，报告重点放在该部分，但其它部分仍要给出状态说明。`.trim();

const GENERAL_CHAT_UNAVAILABLE_REPLY =
  "当前未配置大模型接口，普通聊天暂不可用。请先上传或选择图片后再进行图像分析，或补充 VITE_LLM_BASE_URL、VITE_LLM_API_KEY、VITE_LLM_MODEL 后再试。";

const IMAGE_CONTEXT_CHAT_UNAVAILABLE_REPLY =
  "当前未配置大模型接口，这类普通问答暂不可用。你可以直接询问当前图片的分类、分割或综合分析，或者补充 VITE_LLM_* 配置后再继续聊天。";

const IMAGE_ANALYSIS_PATTERNS = [
  /这张图/,
  /当前图/,
  /当前图片/,
  /分析这张/,
  /识别这张/,
  /这是什么矿物/,
  /帮我识别/,
  /分割.*鲕粒/,
  /分割.*颗粒/,
  /告诉我数量/,
  /count/i,
  /classify/i,
  /segment/i,
  /image_id/i,
];

const FOLLOW_UP_KEYWORDS = [
  "再详细",
  "继续",
  "展开",
  "为什么",
  "怎么理解",
  "解释一下",
  "再说一下",
];

const TOOL_LABELS: Record<AgentToolName, string> = {
  get_image_detail: "读取图像详情",
  classify_mineral: "矿物分类",
  segment_oooids: "鲕粒分割",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  success: "成功",
  pending: "待处理",
  running: "处理中",
  failed: "失败",
};

const emitProgress = (
  onEvent: ((event: AgentProgressEvent) => void) | undefined,
  event: AgentProgressEvent,
) => {
  onEvent?.(event);
};

const sanitizeHistory = (history: AgentMessage[]) =>
  history.filter((item) => item.kind !== "status");

const safeGetSnapshot = async (imageId?: number | null) => {
  if (!imageId || imageId <= 0) {
    return null;
  }

  try {
    return await getImageDetail(imageId);
  } catch {
    return null;
  }
};

const shrinkSnapshot = (snapshot: ImageDetailResponse | null) => {
  if (!snapshot) {
    return null;
  }

  return {
    image: {
      id: snapshot.image.id,
      file_name: snapshot.image.file_name,
      width: snapshot.image.width,
      height: snapshot.image.height,
      upload_time: snapshot.image.upload_time,
      uploader: snapshot.image.uploader.nickname,
    },
    classification: snapshot.classification
      ? {
          status: snapshot.classification.status,
          predicted_class: snapshot.classification.predicted_class,
          confidence: snapshot.classification.confidence,
          model_version: snapshot.classification.model_version,
          error_message: snapshot.classification.error_message,
        }
      : null,
    segmentation: snapshot.segmentation
      ? {
          status: snapshot.segmentation.status,
          grain_count: snapshot.segmentation.grain_count,
          area_ratio: snapshot.segmentation.area_ratio,
          model_version: snapshot.segmentation.model_version,
          error_message: snapshot.segmentation.error_message,
        }
      : null,
  };
};

const formatTaskStatus = (status?: string | null) => {
  if (!status) {
    return "未返回";
  }

  return TASK_STATUS_LABELS[status] ?? status;
};

const isImageAnalysisQuestion = (question: string) => {
  const normalized = question.toLowerCase();
  return IMAGE_ANALYSIS_PATTERNS.some((pattern) => pattern.test(normalized));
};

const looksLikeFollowUp = (question: string) => {
  const normalized = question.replace(/\s+/g, "");
  return FOLLOW_UP_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const shouldUseImageTools = ({
  imageId,
  question,
  history,
}: {
  imageId?: number | null;
  question: string;
  history: AgentMessage[];
}) => {
  if (!imageId) {
    return false;
  }

  if (isImageAnalysisQuestion(question)) {
    return true;
  }

  return (
    looksLikeFollowUp(question) &&
    history.some((item) => Boolean(item.toolCalls?.length || item.snapshot))
  );
};

const buildTemplateReply = (
  question: string,
  snapshot: ImageDetailResponse | null,
  intent: AgentIntent,
) => {
  if (!snapshot) {
    if (isImageAnalysisQuestion(question)) {
      return [
        "## 任务结论",
        "- 当前还没有绑定图片，因此无法生成图像分析报告。",
        "- 如果要分析具体图片，请先上传图片或从图片列表中选择一张图片。",
        "",
        "## 建议与限制",
        "- 当前缺少最基本的图像上下文。",
        "- 绑定图片后我才能继续读取详情、触发分类或分割，并生成报告。",
      ].join("\n");
    }

    return [
      "## 当前状态",
      "- 目前没有绑定图片，因此这里只能进行普通对话，不能生成图像分析报告。",
      "- 如果你要做矿物分类或鲕粒分割，请先上传图片或选择已有图片。",
    ].join("\n");
  }

  const conclusion =
    intent === "classification"
      ? "本次报告重点关注矿物分类结果。"
      : intent === "segmentation"
        ? "本次报告重点关注鲕粒分割结果。"
        : "本次报告基于当前图片的分类与分割结果给出综合结论。";

  const classificationLines = snapshot.classification
    ? snapshot.classification.status === "success"
      ? [
          `- 当前分类状态：${formatTaskStatus(snapshot.classification.status)}。`,
          `- 识别结果：${snapshot.classification.predicted_class ?? "未返回"}。`,
          `- 置信度：${formatConfidence(snapshot.classification.confidence)}。`,
          `- 模型版本：${snapshot.classification.model_version ?? "未返回"}。`,
        ]
      : [
          `- 当前分类状态：${formatTaskStatus(snapshot.classification.status)}。`,
          "- 识别结果尚未可用。",
          `- 错误或说明：${snapshot.classification.error_message ?? "后端暂未返回详细说明"}。`,
        ]
    : [
        "- 当前没有可用的矿物分类结果。",
        "- 如果需要分类结论，需要先触发或等待分类任务完成。",
      ];

  const segmentationLines = snapshot.segmentation
    ? snapshot.segmentation.status === "success"
      ? [
          `- 当前分割状态：${formatTaskStatus(snapshot.segmentation.status)}。`,
          `- 鲕粒数量：${snapshot.segmentation.grain_count ?? 0}。`,
          `- 面积占比：${formatPercent(snapshot.segmentation.area_ratio)}。`,
          `- 模型版本：${snapshot.segmentation.model_version ?? "未返回"}。`,
        ]
      : [
          `- 当前分割状态：${formatTaskStatus(snapshot.segmentation.status)}。`,
          "- 分割结果尚未可用。",
          `- 错误或说明：${snapshot.segmentation.error_message ?? "后端暂未返回详细说明"}。`,
        ]
    : [
        "- 当前没有可用的鲕粒分割结果。",
        "- 如果需要分割结论，需要先触发或等待分割任务完成。",
      ];

  const adviceLines = [
    snapshot.classification?.status === "success" || snapshot.segmentation?.status === "success"
      ? "- 当前报告基于后端已返回的结构化结果整理而成，可继续围绕异常点、可靠性或下一步实验设计追问。": "- 当前至少有一项核心结果尚未完成，因此结论应视为阶段性输出。",
    snapshot.classification?.status === "failed" || snapshot.segmentation?.status === "failed"
      ? "- 某些工具调用失败，建议优先检查后端任务日志、模型文件、存储目录和接口返回信息。": "- 如需更完整结论，可以继续补充「解释原因」「展开风险」「给出建议」等追问。",
  ];

  return [
    "## 任务结论",
    `- ${conclusion}`,
    `- 当前图片：${snapshot.image.file_name}。`,
    "- 这份结论基于后端返回的结构化数据整理，不是后端直接生成的最终自然语言报告。",
    "",
    "## 图片概况",
    `- 图片 ID：${snapshot.image.id}。`,
    `- 尺寸：${snapshot.image.width} × ${snapshot.image.height}。`,
    `- 上传时间：${formatDateTime(snapshot.image.upload_time)}。`,
    `- 上传用户：${snapshot.image.uploader.nickname}（${snapshot.image.uploader.username}）。`,
    "",
    "## 矿物分类结果",
    ...classificationLines,
    "",
    "## 鲕粒分割结果",
    ...segmentationLines,
    "",
    "## 建议与限制",
    ...adviceLines,
  ].join("\n");
};

const getToolPlan = (intent: AgentIntent): AgentToolName[] => {
  if (intent === "classification") {
    return ["get_image_detail", "classify_mineral"];
  }

  if (intent === "segmentation") {
    return ["get_image_detail", "segment_oooids"];
  }

  return ["get_image_detail", "classify_mineral", "segment_oooids"];
};

const streamGeneralChat = async ({
  question,
  history,
  imageId,
  snapshot,
  onPartialReply,
}: {
  question: string;
  history: AgentMessage[];
  imageId?: number | null;
  snapshot?: ImageDetailResponse | null;
  onPartialReply?: (fullText: string) => void;
}) => {
  if (!hasLlmConfig()) {
    throw new Error("当前未配置大模型接口，无法进行普通聊天。");
  }

  const systemMessages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: GENERAL_CHAT_PROMPT,
    },
  ];

  // Inject conversation memory summary
  if (imageId) {
    const scope = String(imageId);
    const summary = getConversationSummary(scope);
    if (summary) {
      systemMessages.push({
        role: "system",
        content: `[历史对话摘要]\n${summary}`,
      });
    }

    // Inject image memory
    const imageMemory = getImageMemory(imageId);
    if (imageMemory) {
      systemMessages.push({
        role: "system",
        content: `[历史分析记录]\n${buildImageMemoryContext(imageMemory)}`,
      });
    }
  }

  if (imageId && snapshot) {
    systemMessages.push({
      role: "system",
      content: `当前会话绑定了图片 #${imageId}（${snapshot.image?.file_name}）。以下是该图片的结构化信息：${JSON.stringify(shrinkSnapshot(snapshot))}`,
    });
  }

  // 在用户消息中带上图片
  const imageUrl = snapshot?.image?.origin_url;
  const resolvedUrl = imageUrl ? resolveAssetUrl(imageUrl) : null;

  const userContent: MessageContent = resolvedUrl
    ? [
        { type: "text" as const, text: question },
        { type: "image_url" as const, image_url: { url: resolvedUrl } },
      ]
    : question;

  const messages: ChatCompletionMessage[] = [
    ...systemMessages,
    ...sanitizeHistory(history).map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: "user",
      content: userContent,
    },
  ];

  const reply = await streamChatCompletion({
    messages,
    temperature: 0.5,
    onChunk: (_, fullText) => {
      onPartialReply?.(fullText);
    },
  });

  if (!reply.trim()) {
    throw new Error("模型没有返回有效内容。");
  }

  return reply;
};

const streamImageSummary = async ({
  imageId,
  question,
  snapshot,
  toolCalls,
  onPartialReply,
}: {
  imageId: number;
  question: string;
  snapshot: ImageDetailResponse | null;
  toolCalls: AgentToolCall[];
  onPartialReply?: (fullText: string) => void;
}) => {
  if (!hasLlmConfig()) {
    return buildTemplateReply(question, snapshot, inferAgentIntent(question));
  }

  const summaryData = JSON.stringify(
    {
      image_id: imageId,
      question,
      snapshot: shrinkSnapshot(snapshot),
      tool_calls: toolCalls.map((item) => ({
        name: item.name,
        status: item.status,
        resultSummary: item.resultSummary,
        errorMessage: item.errorMessage,
      })),
    },
    null,
    2,
  );

  const imageUrl = snapshot?.image?.origin_url;
  const resolvedUrl = imageUrl ? resolveAssetUrl(imageUrl) : null;

  // 把图片 + 分析指令 + 结构化数据合在一条用户消息里，确保模型同时看到图片和数据
  const userContent: MessageContent = resolvedUrl
    ? [
        {
          type: "text" as const,
          text: `请先仔细观察这张岩石薄片图片，描述你看到的视觉特征（颜色、纹理、颗粒形态、矿物分布等），然后结合以下后端接口返回的结构化分析数据，生成综合分析报告。\n\n${summaryData}`,
        },
        {
          type: "image_url" as const,
          image_url: { url: resolvedUrl },
        },
      ]
    : summaryData;

  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: SUMMARY_PROMPT,
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  const reply = await streamChatCompletion({
    messages,
    temperature: 0.3,
    onChunk: (_, fullText) => {
      onPartialReply?.(fullText);
    },
  });

  if (!reply.trim()) {
    throw new Error("模型没有返回总结内容。");
  }

  return reply;
};

export const streamAgentTurn = async ({
  imageId,
  question,
  history,
  onPartialReply,
  onToolCalls,
  onSnapshot,
  onEvent,
}: {
  imageId?: number | null;
  question: string;
  history: AgentMessage[];
  onPartialReply?: (fullText: string) => void;
  onToolCalls?: (toolCalls: AgentToolCall[]) => void;
  onSnapshot?: (snapshot: ImageDetailResponse | null) => void;
  onEvent?: (event: AgentProgressEvent) => void;
}): Promise<AgentTurnResult> => {
  const conversationalHistory = sanitizeHistory(history);

  emitProgress(onEvent, {
    stage: "intent",
    message: "Agent 正在分析意图，判断当前问题是否需要图像工具。",
  });

  const existingSnapshot = await safeGetSnapshot(imageId);

  if (!imageId) {
    if (isImageAnalysisQuestion(question)) {
      emitProgress(onEvent, {
        stage: "mode",
        message: "判定为图像分析请求，但当前会话还没有绑定图片。",
      });

      const reply =
        "当前还没有绑定图片。如果你想分析具体图片，请先上传图片或从图片列表中选择一张图片。";
      onPartialReply?.(reply);

      emitProgress(onEvent, {
        stage: "response",
        message: "已返回提示信息，等待用户上传或选择图片后再继续分析。",
      });

      return {
        reply,
        toolCalls: [],
        snapshot: null,
      };
    }

    if (!hasLlmConfig()) {
      emitProgress(onEvent, {
        stage: "mode",
        message: "当前未绑定图片，且未配置大模型接口，普通聊天不可用。",
      });
      emitProgress(onEvent, {
        stage: "response",
        message: "已返回普通聊天不可用提示，等待用户绑定图片或补充大模型配置。",
      });
      onPartialReply?.(GENERAL_CHAT_UNAVAILABLE_REPLY);

      return {
        reply: GENERAL_CHAT_UNAVAILABLE_REPLY,
        toolCalls: [],
        snapshot: null,
      };
    }

    emitProgress(onEvent, {
      stage: "mode",
      message: "当前未绑定图片，进入普通对话模式。",
    });
    emitProgress(onEvent, {
      stage: "response",
      message: "开始流式生成普通对话回复。",
    });

    const reply = await streamGeneralChat({
      question,
      history: conversationalHistory,
      onPartialReply,
    });

    return {
      reply,
      toolCalls: [],
      snapshot: null,
    };
  }

  if (!shouldUseImageTools({ imageId, question, history: conversationalHistory })) {
    onSnapshot?.(existingSnapshot);

    if (!hasLlmConfig()) {
      emitProgress(onEvent, {
        stage: "mode",
        message:
          "当前已绑定图片，但本次问题不触发图像工具，且未配置大模型接口，无法继续普通问答。",
      });
      emitProgress(onEvent, {
        stage: "response",
        message: "已返回引导提示，建议直接发起图片分类、分割或综合分析问题。",
      });
      onPartialReply?.(IMAGE_CONTEXT_CHAT_UNAVAILABLE_REPLY);

      return {
        reply: IMAGE_CONTEXT_CHAT_UNAVAILABLE_REPLY,
        toolCalls: [],
        snapshot: existingSnapshot,
      };
    }

    emitProgress(onEvent, {
      stage: "mode",
      message:
        "当前已绑定图片上下文，但这次问题不需要调用图像工具，继续按普通对话处理。",
    });
    emitProgress(onEvent, {
      stage: "response",
      message: "开始流式生成结合上下文的回答。",
    });

    const reply = await streamGeneralChat({
      question,
      history: conversationalHistory,
      imageId,
      snapshot: existingSnapshot,
      onPartialReply,
    });

    return {
      reply,
      toolCalls: [],
      snapshot: existingSnapshot,
    };
  }

  const intent = inferAgentIntent(question);
  const toolPlan = getToolPlan(intent);
  const toolCalls: AgentToolCall[] = [];

  emitProgress(onEvent, {
    stage: "mode",
    message: `已进入图像分析模式，计划调用 ${toolPlan
      .map((toolName) => TOOL_LABELS[toolName])
      .join("、")}。`,
  });

  for (const toolName of toolPlan) {
    emitProgress(onEvent, {
      stage: "tool",
      message: `正在调用工具：${TOOL_LABELS[toolName]}（${toolName}）。`,
    });

    const toolOutput = await executeAgentTool(
      toolName,
      { image_id: imageId },
      { imageId },
    );

    toolCalls.push(toolOutput.trace);
    onToolCalls?.([...toolCalls]);

    emitProgress(onEvent, {
      stage: toolOutput.trace.status === "success" ? "tool" : "error",
      message:
        toolOutput.trace.status === "success"
          ? `${TOOL_LABELS[toolName]}已返回：${toolOutput.trace.resultSummary}`
          : `${TOOL_LABELS[toolName]}调用失败：${
              toolOutput.trace.errorMessage || toolOutput.trace.resultSummary
            }`,
    });
  }

  emitProgress(onEvent, {
    stage: "summary",
    message: "工具调用完成，正在同步最新结构化结果。",
  });

  const snapshot = await safeGetSnapshot(imageId);
  onSnapshot?.(snapshot);

  emitProgress(onEvent, {
    stage: "summary",
    message: hasLlmConfig()
      ? "结构化结果已更新，正在整理最终报告。"
      : "未配置大模型总结，正在使用前端模板生成报告。",
  });

  try {
    const reply = await streamImageSummary({
      imageId,
      question,
      snapshot,
      toolCalls,
      onPartialReply,
    });

    // Save image memory after successful analysis
    if (snapshot && toolCalls.length > 0) {
      saveImageMemory({
        imageId,
        fileName: snapshot.image.file_name,
        classification: snapshot.classification,
        segmentation: snapshot.segmentation,
        lastSummary: reply.slice(0, 500),
        timestamp: Date.now(),
      });
    }

    // Check if conversation should be summarized
    const scope = String(imageId);
    const allMessages = [
      ...conversationalHistory,
      { role: "user" as const, content: question, id: "", createdAt: "" },
      { role: "assistant" as const, content: reply, id: "", createdAt: "" },
    ];
    if (shouldSummarize(allMessages)) {
      try {
        const summaryPrompt = buildSummarizationPrompt(allMessages);
        const summaryReply = await streamChatCompletion({
          messages: [
            { role: "user", content: summaryPrompt },
          ],
          temperature: 0.3,
        });
        if (summaryReply.trim()) {
          saveConversationSummary(scope, summaryReply.trim());
        }
      } catch {
        // Summary generation is best-effort
      }
    }

    return {
      reply,
      toolCalls,
      snapshot,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "模型总结失败。";
    const fallback = buildTemplateReply(question, snapshot, intent);
    const reply = `模型总结失败：${errorMessage}\n\n已基于当前接口结果返回前端兜底报告：\n\n${fallback}`;

    emitProgress(onEvent, {
      stage: "error",
      message: `模型总结失败，改为返回前端兜底报告：${errorMessage}`,
    });
    onPartialReply?.(reply);

    return {
      reply,
      toolCalls,
      snapshot,
    };
  }
};
