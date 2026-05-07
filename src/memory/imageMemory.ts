import type { ClassificationResult, SegmentationResult } from "@/types/image";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/memory/storage";

const IMAGE_MEMORY_PREFIX = "rock-agent-memory-image";
const MAX_IMAGE_MEMORIES = 50;

export interface ImageMemoryData {
  imageId: number;
  fileName: string;
  classification: ClassificationResult | null;
  segmentation: SegmentationResult | null;
  lastSummary: string;
  timestamp: number;
}

const getImageMemoryKey = (imageId: number) =>
  `${IMAGE_MEMORY_PREFIX}:${imageId}`;

export const getImageMemory = (imageId: number): ImageMemoryData | null => {
  const raw = safeGetItem(getImageMemoryKey(imageId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ImageMemoryData;
  } catch {
    return null;
  }
};

export const saveImageMemory = (data: ImageMemoryData) => {
  safeSetItem(getImageMemoryKey(data.imageId), JSON.stringify(data));
  evictOldMemories();
};

export const clearImageMemory = (imageId: number) => {
  safeRemoveItem(getImageMemoryKey(imageId));
};

const evictOldMemories = () => {
  const prefix = IMAGE_MEMORY_PREFIX + ":";
  const entries: Array<{ key: string; timestamp: number }> = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as ImageMemoryData;
      entries.push({ key, timestamp: parsed.timestamp });
    } catch {
      continue;
    }
  }

  if (entries.length <= MAX_IMAGE_MEMORIES) return;

  entries.sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = entries.slice(0, entries.length - MAX_IMAGE_MEMORIES);
  for (const entry of toRemove) {
    window.localStorage.removeItem(entry.key);
  }
};

export const buildImageMemoryContext = (memory: ImageMemoryData): string => {
  const lines: string[] = [
    `此前曾分析过图片 "${memory.fileName}"（ID: ${memory.imageId}），以下是历史分析结果：`,
  ];

  if (memory.classification?.status === "success") {
    lines.push(
      `- 矿物分类：${memory.classification.predicted_class}，置信度 ${((memory.classification.confidence ?? 0) * 100).toFixed(1)}%`,
    );
  }

  if (memory.segmentation?.status === "success") {
    lines.push(
      `- 鲕粒分割：${memory.segmentation.grain_count ?? 0} 个颗粒，面积占比 ${((memory.segmentation.area_ratio ?? 0) * 100).toFixed(1)}%`,
    );
  }

  if (memory.lastSummary) {
    lines.push(`- 上次分析摘要：${memory.lastSummary}`);
  }

  return lines.join("\n");
};
