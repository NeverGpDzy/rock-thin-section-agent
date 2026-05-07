import { Card, Space, Tag, Typography } from "antd";
import type { AgentToolCall } from "@/types/agent";

const TOOL_LABELS: Record<string, string> = {
  get_image_detail: "获取图片详情",
  classify_mineral: "调用矿物分类",
  segment_oooids: "调用鲕粒分割",
  search_knowledge: "知识库检索",
};

export const AgentToolList = ({ toolCalls }: { toolCalls: AgentToolCall[] }) => {
  if (!toolCalls.length) {
    return null;
  }

  return (
    <div className="agent-tool-list">
      {toolCalls.map((toolCall) => (
        <Card
          key={toolCall.id}
          size="small"
          className="agent-tool-card"
          title={TOOL_LABELS[toolCall.name] ?? toolCall.name}
          extra={
            <Tag color={toolCall.status === "success" ? "success" : "error"}>
              {toolCall.status === "success" ? "成功" : "失败"}
            </Tag>
          }
        >
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">
              参数: {JSON.stringify(toolCall.args)}
            </Typography.Text>
            <Typography.Text>{toolCall.resultSummary}</Typography.Text>
            {toolCall.errorMessage ? (
              <Typography.Text type="danger">
                {toolCall.errorMessage}
              </Typography.Text>
            ) : null}
          </Space>
        </Card>
      ))}
    </div>
  );
};
