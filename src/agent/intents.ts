import type { AgentIntent } from "@/types/agent";

const OVERVIEW_KEYWORDS = ["分析", "总结", "整体", "综合", "这张图", "当前图片"];
const CLASSIFICATION_KEYWORDS = ["矿物", "岩性", "识别", "分类", "是什么"];
const SEGMENTATION_KEYWORDS = ["分割", "鲕粒", "轮廓", "数量", "颗粒", "面积"];

export const inferAgentIntent = (question: string): AgentIntent => {
  const normalized = question.replace(/\s+/g, "");

  if (OVERVIEW_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "overview";
  }

  const wantsClassification = CLASSIFICATION_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
  const wantsSegmentation = SEGMENTATION_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );

  if (wantsClassification && wantsSegmentation) {
    return "overview";
  }

  if (wantsSegmentation) {
    return "segmentation";
  }

  if (wantsClassification) {
    return "classification";
  }

  return "overview";
};
