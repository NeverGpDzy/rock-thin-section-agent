import type { AgentMessage } from "@/types/agent";
import type { ImageDetailResponse } from "@/types/image";
import { formatConfidence, formatDateTime, formatPercent } from "@/utils/format";

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const toSafeFilename = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");

export const maskSecret = (value: string) => {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}****`;
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
};

export const buildExportBaseName = ({
  imageId,
  snapshot,
}: {
  imageId?: number | null;
  snapshot?: ImageDetailResponse | null;
}) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const imagePart = imageId
    ? `image-${imageId}`
    : snapshot?.image?.id
      ? `image-${snapshot.image.id}`
      : "general";

  return toSafeFilename(`agent-${imagePart}-${stamp}`);
};

export const downloadTextFile = (
  filename: string,
  content: string,
  type = "text/markdown;charset=utf-8",
) => {
  downloadBlob(filename, new Blob([content], { type }));
};

export const downloadJsonFile = (filename: string, data: unknown) => {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
};

export const downloadRemoteFile = async (url: string, filename: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`下载失败：${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  downloadBlob(filename, blob);
};

const formatSnapshotMarkdown = (snapshot: ImageDetailResponse | null | undefined) => {
  if (!snapshot) {
    return [
      "## 图片结果",
      "- 当前没有可导出的图片分析结果。",
    ].join("\n");
  }

  return [
    "## 图片概况",
    `- 图片 ID：${snapshot.image.id}`,
    `- 文件名：${snapshot.image.file_name}`,
    `- 尺寸：${snapshot.image.width} × ${snapshot.image.height}`,
    `- 上传时间：${formatDateTime(snapshot.image.upload_time)}`,
    `- 上传用户：${snapshot.image.uploader.nickname}（${snapshot.image.uploader.username}）`,
    "",
    "## 矿物分类结果",
    snapshot.classification
      ? snapshot.classification.status === "success"
        ? `- 状态：成功\n- 识别结果：${snapshot.classification.predicted_class ?? "未返回"}\n- 置信度：${formatConfidence(snapshot.classification.confidence)}\n- 模型版本：${snapshot.classification.model_version ?? "未返回"}`
        : `- 状态：${snapshot.classification.status}\n- 错误说明：${snapshot.classification.error_message ?? "未返回"}`
      : "- 暂无分类结果",
    "",
    "## 鲕粒分割结果",
    snapshot.segmentation
      ? snapshot.segmentation.status === "success"
        ? `- 状态：成功\n- 鲕粒数量：${snapshot.segmentation.grain_count ?? 0}\n- 面积占比：${formatPercent(snapshot.segmentation.area_ratio)}\n- 模型版本：${snapshot.segmentation.model_version ?? "未返回"}\n- 叠加图：${snapshot.segmentation.overlay_url ?? "未返回"}\n- 掩膜图：${snapshot.segmentation.mask_url ?? "未返回"}`
        : `- 状态：${snapshot.segmentation.status}\n- 错误说明：${snapshot.segmentation.error_message ?? "未返回"}`
      : "- 暂无分割结果",
  ].join("\n");
};

export const buildConversationMarkdown = ({
  scope,
  imageId,
  snapshot,
  messages,
}: {
  scope: string;
  imageId?: number | null;
  snapshot?: ImageDetailResponse | null;
  messages: AgentMessage[];
}) => [
  "# Agent 会话导出",
  `- 导出时间：${formatDateTime(new Date().toISOString())}`,
  `- 会话范围：${scope}`,
  `- 当前图片：${imageId ? `#${imageId}` : "未绑定图片"}`,
  "",
  formatSnapshotMarkdown(snapshot),
  "",
  "## 会话记录",
  ...messages.flatMap((item, index) => {
    const roleLabel =
      item.role === "user"
        ? "用户"
        : item.kind === "status"
          ? "Agent 状态"
          : "助手";

    return [
      `### ${index + 1}. ${roleLabel}`,
      `- 时间：${formatDateTime(item.createdAt)}`,
      `- 状态：${item.status ?? "done"}`,
      "",
      item.content,
      "",
    ];
  }),
].join("\n");

export const buildAnalysisMarkdown = ({
  imageId,
  snapshot,
  latestAssistantReply,
}: {
  imageId?: number | null;
  snapshot?: ImageDetailResponse | null;
  latestAssistantReply?: string | null;
}) => [
  "# 图片分析结果导出",
  `- 导出时间：${formatDateTime(new Date().toISOString())}`,
  `- 当前图片：${imageId ? `#${imageId}` : "未绑定图片"}`,
  "",
  latestAssistantReply
    ? [
        "## 最近一次分析报告",
        latestAssistantReply,
      ].join("\n")
    : formatSnapshotMarkdown(snapshot),
].join("\n");

export const buildSessionExportBundle = ({
  scope,
  imageId,
  snapshot,
  messages,
  llm,
}: {
  scope: string;
  imageId?: number | null;
  snapshot?: ImageDetailResponse | null;
  messages: AgentMessage[];
  llm: {
    source: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
  };
}) => ({
  exportedAt: new Date().toISOString(),
  scope,
  imageId: imageId ?? null,
  llm,
  snapshot: snapshot ?? null,
  messages,
});
