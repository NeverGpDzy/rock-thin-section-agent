import { ClockCircleOutlined, EyeOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ImageMemoryData } from "@/memory/imageMemory";
import { formatConfidence, formatDateTime, formatPercent } from "@/utils/format";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const IMAGE_MEMORY_PREFIX = "rock-agent-memory-image:";

function loadAllImageMemories(): ImageMemoryData[] {
  const entries: ImageMemoryData[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(IMAGE_MEMORY_PREFIX)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      entries.push(JSON.parse(raw) as ImageMemoryData);
    } catch {
      continue;
    }
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

export const HistoryPage = () => {
  const navigate = useNavigate();

  const memories = useMemo(() => loadAllImageMemories(), []);

  const columns = useMemo(() => [
    {
      title: "图片名称",
      dataIndex: "fileName",
      key: "fileName",
      ellipsis: true,
      render: (name: string) => (
        <Typography.Text strong>{name}</Typography.Text>
      ),
    },
    {
      title: "矿物分类",
      key: "classification",
      width: 180,
      render: (_: unknown, record: ImageMemoryData) => {
        if (record.classification?.status === "success") {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="green">{record.classification.predicted_class}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                置信度 {formatConfidence(record.classification.confidence)}
              </Typography.Text>
            </Space>
          );
        }
        return <Tag>未分类</Tag>;
      },
    },
    {
      title: "鲕粒分割",
      key: "segmentation",
      width: 180,
      render: (_: unknown, record: ImageMemoryData) => {
        if (record.segmentation?.status === "success") {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="blue">
                {record.segmentation.grain_count ?? 0} 个颗粒
              </Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                面积占比 {formatPercent(record.segmentation.area_ratio)}
              </Typography.Text>
            </Space>
          );
        }
        return <Tag>未分割</Tag>;
      },
    },
    {
      title: "分析时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 180,
      render: (ts: number) => (
        <Space>
          <ClockCircleOutlined />
          <span>{formatDateTime(new Date(ts).toISOString())}</span>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: unknown, record: ImageMemoryData) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() =>
            navigate(`/agent?imageId=${record.imageId}`)
          }
        >
          查看
        </Button>
      ),
    },
  ], [navigate]);

  const expandedRowRender = (record: ImageMemoryData) => {
    if (!record.lastSummary) return null;
    return (
      <div style={{ padding: "8px 0" }}>
        <Typography.Text type="secondary">分析摘要：</Typography.Text>
        <MarkdownMessage content={record.lastSummary} />
      </div>
    );
  };

  return (
    <div style={{ padding: "0 0 24px" }}>
      <Card>
        <Typography.Title level={4} style={{ margin: "0 0 16px" }}>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          分析历史
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          共 {memories.length} 条分析记录（最多保存 50 条）
        </Typography.Paragraph>

        {memories.length === 0 ? (
          <Empty description="暂无分析记录，请先在 Agent 分析页面分析图片" />
        ) : (
          <Table
            dataSource={memories}
            columns={columns}
            rowKey="imageId"
            expandable={{
              expandedRowRender,
              rowExpandable: (record) => !!record.lastSummary,
            }}
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
};
