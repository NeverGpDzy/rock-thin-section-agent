import { Tag } from "antd";
import type { TaskStatus } from "@/types/api";

const STATUS_MAP: Record<
  TaskStatus,
  {
    color: string;
    label: string;
  }
> = {
  pending: { color: "gold", label: "等待中" },
  running: { color: "processing", label: "分析中" },
  success: { color: "success", label: "已完成" },
  failed: { color: "error", label: "失败" },
};

export const StatusTag = ({
  status,
}: {
  status: TaskStatus | null | undefined;
}) => {
  if (!status) {
    return <Tag>未分析</Tag>;
  }

  return <Tag color={STATUS_MAP[status].color}>{STATUS_MAP[status].label}</Tag>;
};
