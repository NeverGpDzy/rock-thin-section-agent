import {
  ClearOutlined,
  DownloadOutlined,
  InboxOutlined,
  LoadingOutlined,
  SendOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  Image as AntImage,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  message,
  type MenuProps,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { streamAgentTurn } from "@/agent/orchestrator";
import { getImageDetail, listImages, uploadImage } from "@/api/images";
import { extractErrorMessage } from "@/api/client";
import { AgentToolList } from "@/components/AgentToolList";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { StatusTag } from "@/components/StatusTag";
import { getRuntimeLlmConfig } from "@/config/env";
import type { AgentMessage } from "@/types/agent";
import { resolveAssetUrl } from "@/utils/assets";
import {
  buildAnalysisMarkdown,
  buildConversationMarkdown,
  buildExportBaseName,
  buildSessionExportBundle,
  downloadJsonFile,
  downloadRemoteFile,
  downloadTextFile,
  maskSecret,
} from "@/utils/export";
import {
  formatConfidence,
  formatDateTime,
  formatPercent,
} from "@/utils/format";
import {
  clearConversation,
  clearStoredLlmConfig,
  loadConversation,
  saveConversation,
  saveStoredLlmConfig,
  type ConversationScope,
  type StoredLlmConfig,
} from "@/utils/storage";

const QUICK_PROMPTS = [
  "你能做什么？",
  "帮我解释一下这个系统能分析什么",
  "分析这张图",
  "这是什么矿物？",
  "分割出鲕粒并告诉我数量",
];

const getConfigSourceLabel = (source: ReturnType<typeof getRuntimeLlmConfig>["source"]) => {
  if (source === "local") {
    return "前端本地配置";
  }

  if (source === "env") {
    return "环境默认配置";
  }

  return "未配置";
};

export const AgentPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLlmModalOpen, setIsLlmModalOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState(() => getRuntimeLlmConfig());
  const [llmForm] = Form.useForm<StoredLlmConfig>();
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const currentImageId = Number(searchParams.get("imageId") ?? 0);
  const hasSelectedImage = Number.isFinite(currentImageId) && currentImageId > 0;
  const conversationScope: ConversationScope = hasSelectedImage
    ? currentImageId
    : "general";
  const llmConfigured = Boolean(
    llmConfig.llmBaseUrl && llmConfig.llmApiKey && llmConfig.llmModel,
  );
  const isGeneralChatUnavailable = !llmConfigured && !hasSelectedImage;

  const imagesQuery = useQuery({
    queryKey: ["agent-images"],
    queryFn: () => listImages(1, 50),
  });

  const detailQuery = useQuery({
    queryKey: ["image-detail", currentImageId],
    queryFn: () => getImageDetail(currentImageId),
    enabled: hasSelectedImage,
  });

  useEffect(() => {
    setMessages(loadConversation(conversationScope));
  }, [conversationScope]);

  useEffect(() => {
    saveConversation(conversationScope, messages);
  }, [conversationScope, messages]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const syncLlmConfig = () => {
      setLlmConfig(getRuntimeLlmConfig());
    };

    window.addEventListener("storage", syncLlmConfig);
    return () => {
      window.removeEventListener("storage", syncLlmConfig);
    };
  }, []);

  const latestSnapshot = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].kind !== "status" && messages[index].snapshot) {
        return messages[index].snapshot;
      }
    }

    return detailQuery.data ?? null;
  }, [detailQuery.data, messages]);

  const latestAssistantMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index];
      if (item.role === "assistant" && item.kind !== "status") {
        return item;
      }
    }

    return null;
  }, [messages]);

  const exportBaseName = useMemo(
    () =>
      buildExportBaseName({
        imageId: hasSelectedImage ? currentImageId : null,
        snapshot: latestSnapshot,
      }),
    [currentImageId, hasSelectedImage, latestSnapshot],
  );

  const setCurrentImageId = (imageId?: number | null) => {
    if (imageId && imageId > 0) {
      setSearchParams({ imageId: String(imageId) });
      return;
    }

    setSearchParams({});
  };

  const refreshLlmConfig = () => {
    setLlmConfig(getRuntimeLlmConfig());
  };

  const openLlmSettings = () => {
    llmForm.setFieldsValue({
      baseUrl: llmConfig.llmBaseUrl,
      apiKey: llmConfig.llmApiKey,
      model: llmConfig.llmModel,
    });
    setIsLlmModalOpen(true);
  };

  const handleSaveLlmSettings = async () => {
    const values = await llmForm.validateFields();
    saveStoredLlmConfig({
      baseUrl: values.baseUrl.trim(),
      apiKey: values.apiKey.trim(),
      model: values.model.trim(),
    });
    refreshLlmConfig();
    setIsLlmModalOpen(false);
    message.success("前端模型配置已保存，后续请求会优先使用这组参数。");
  };

  const handleResetLlmSettings = () => {
    clearStoredLlmConfig();
    const next = getRuntimeLlmConfig();
    llmForm.setFieldsValue({
      baseUrl: next.llmBaseUrl,
      apiKey: next.llmApiKey,
      model: next.llmModel,
    });
    refreshLlmConfig();
    message.success("已清除前端自定义模型配置，恢复为环境默认配置。");
  };

  const updateAssistantMessage = (
    assistantId: string,
    patch: Partial<AgentMessage>,
  ) => {
    setMessages((previous) =>
      previous.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const appendStatusMessage = (
    content: string,
    status: AgentMessage["status"] = "done",
  ) => {
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "status",
        content,
        createdAt: new Date().toISOString(),
        status,
      },
    ]);
  };

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const response = await uploadImage(file);
      const newId = response.image.id;
      // 清除新图片的旧对话记录，避免切换后加载到残留消息
      clearConversation(newId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["images"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-images"] }),
      ]);
      setCurrentImageId(newId);
      message.success("图片上传成功，已切换到该图片上下文。");
    } catch (error) {
      message.error(extractErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();

    if (!trimmed || isSending) {
      return;
    }

    const previousMessages = [...messages];
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      kind: "message",
      content: trimmed,
      createdAt: new Date().toISOString(),
      status: "done",
    };
    const assistantId = crypto.randomUUID();
    let latestToolCalls: AgentMessage["toolCalls"] = [];
    let latestRunSnapshot = latestSnapshot;

    const upsertAssistantMessage = (patch: Partial<AgentMessage>) => {
      setMessages((previous) => {
        const exists = previous.some((item) => item.id === assistantId);

        if (!exists) {
          return [
            ...previous,
            {
              id: assistantId,
              role: "assistant",
              kind: "message",
              content:
                patch.content ||
                (hasSelectedImage
                  ? "正在分析当前图片并生成报告..."
                  : "正在生成回复..."),
              createdAt: new Date().toISOString(),
              status: "streaming",
              toolCalls: latestToolCalls ?? [],
              snapshot: latestRunSnapshot,
              ...patch,
            },
          ];
        }

        return previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                ...patch,
              }
            : item,
        );
      });
    };

    setMessages([...previousMessages, userMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const result = await streamAgentTurn({
        imageId: hasSelectedImage ? currentImageId : null,
        question: trimmed,
        history: previousMessages,
        onEvent: (event) => {
          appendStatusMessage(
            event.message,
            event.stage === "error" ? "error" : "done",
          );
        },
        onPartialReply: (fullText) => {
          upsertAssistantMessage({
            content: fullText || "正在生成回复...",
            status: "streaming",
          });
        },
        onToolCalls: (toolCalls) => {
          latestToolCalls = toolCalls;
          updateAssistantMessage(assistantId, {
            toolCalls,
          });
        },
        onSnapshot: (snapshot) => {
          latestRunSnapshot = snapshot;
          updateAssistantMessage(assistantId, {
            snapshot,
          });
        },
      });

      latestToolCalls = result.toolCalls;
      latestRunSnapshot = result.snapshot;

      upsertAssistantMessage({
        content: result.reply,
        status: "done",
        toolCalls: result.toolCalls,
        snapshot: result.snapshot,
      });

      if (hasSelectedImage) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["image-detail", currentImageId],
          }),
          queryClient.invalidateQueries({ queryKey: ["images"] }),
        ]);
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      appendStatusMessage(`Agent 执行失败：${errorMessage}`, "error");
      upsertAssistantMessage({
        content: `请求失败：${errorMessage}`,
        status: "error",
        toolCalls: latestToolCalls,
        snapshot: latestRunSnapshot,
      });
    } finally {
      setIsSending(false);
    }
  };

  const clearCurrentConversation = () => {
    clearConversation(conversationScope);
    setMessages([]);
    message.success(
      hasSelectedImage ? "当前图片会话已清空。" : "普通聊天会话已清空。",
    );
  };

  const handleExportConversation = () => {
    if (!messages.length) {
      message.warning("当前没有可导出的聊天内容。");
      return;
    }

    const content = buildConversationMarkdown({
      scope: String(conversationScope),
      imageId: hasSelectedImage ? currentImageId : null,
      snapshot: latestSnapshot,
      messages,
    });

    downloadTextFile(`${exportBaseName}-conversation.md`, content);
    message.success("聊天记录已导出。");
  };

  const handleExportAnalysis = () => {
    if (!latestSnapshot && !latestAssistantMessage?.content) {
      message.warning("当前没有可导出的分析结果。");
      return;
    }

    const content = buildAnalysisMarkdown({
      imageId: hasSelectedImage ? currentImageId : null,
      snapshot: latestSnapshot,
      latestAssistantReply: latestAssistantMessage?.content ?? null,
    });

    downloadTextFile(`${exportBaseName}-analysis.md`, content);
    message.success("分析结果已导出。");
  };

  const handleExportBundle = () => {
    if (!messages.length && !latestSnapshot) {
      message.warning("当前没有可导出的会话数据。");
      return;
    }

    const bundle = buildSessionExportBundle({
      scope: String(conversationScope),
      imageId: hasSelectedImage ? currentImageId : null,
      snapshot: latestSnapshot,
      messages,
      llm: {
        source: llmConfig.source,
        baseUrl: llmConfig.llmBaseUrl,
        model: llmConfig.llmModel,
        apiKeyMasked: maskSecret(llmConfig.llmApiKey),
      },
    });

    downloadJsonFile(`${exportBaseName}-bundle.json`, bundle);
    message.success("会话包已导出。");
  };

  const handleDownloadSegmentationAsset = async (
    assetUrl: string | null | undefined,
    assetName: string,
  ) => {
    if (!assetUrl) {
      message.warning(`当前没有可下载的${assetName}。`);
      return;
    }

    try {
      await downloadRemoteFile(
        resolveAssetUrl(assetUrl),
        `${exportBaseName}-${assetName}`,
      );
      message.success(`${assetName}已开始下载。`);
    } catch (error) {
      message.error(extractErrorMessage(error));
    }
  };

  const exportMenuItems: MenuProps["items"] = [
    {
      key: "conversation",
      label: "导出聊天记录（Markdown）",
      onClick: handleExportConversation,
      disabled: !messages.length,
    },
    {
      key: "analysis",
      label: "导出分析结果（Markdown）",
      onClick: handleExportAnalysis,
      disabled: !latestSnapshot && !latestAssistantMessage?.content,
    },
    {
      key: "bundle",
      label: "一键导出会话包（JSON）",
      onClick: handleExportBundle,
      disabled: !messages.length && !latestSnapshot,
    },
    {
      key: "overlay",
      label: "下载分割叠加图",
      onClick: () =>
        void handleDownloadSegmentationAsset(
          latestSnapshot?.segmentation?.overlay_url,
          "segmentation-overlay.png",
        ),
      disabled: !latestSnapshot?.segmentation?.overlay_url,
    },
    {
      key: "mask",
      label: "下载分割掩膜图",
      onClick: () =>
        void handleDownloadSegmentationAsset(
          latestSnapshot?.segmentation?.mask_url,
          "segmentation-mask.png",
        ),
      disabled: !latestSnapshot?.segmentation?.mask_url,
    },
  ];

  return (
    <div className="page-stack agent-page">
      <div className="panel-card agent-toolbar">
        <div className="agent-toolbar__summary">
          <div className="agent-toolbar__tags">
            <Tag color={llmConfigured ? "success" : "warning"}>
              {llmConfigured ? "模型已配置" : "模型未配置"}
            </Tag>
            <Tag color={hasSelectedImage ? "processing" : "default"}>
              {hasSelectedImage ? `图片 #${currentImageId}` : "普通聊天"}
            </Tag>
            <Tag>{getConfigSourceLabel(llmConfig.source)}</Tag>
          </div>
          <Typography.Text type="secondary" className="agent-toolbar__hint">
            {llmConfigured
              ? `${llmConfig.llmModel} · ${llmConfig.llmBaseUrl}`
              : "未配置模型参数，绑定图片后可调用分类和分割接口。"}
          </Typography.Text>
        </div>

        <Space className="agent-toolbar__actions" size={8}>
          <Button size="small" icon={<SettingOutlined />} onClick={openLlmSettings}>
            模型设置
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} trigger={["click"]}>
            <Button size="small" icon={<DownloadOutlined />}>导出</Button>
          </Dropdown>
          <Button size="small" icon={<ClearOutlined />} onClick={clearCurrentConversation}>
            清空
          </Button>
        </Space>
      </div>

      <div className="agent-grid agent-grid--workspace">
        <div className="agent-left">
          <Card
            className="panel-card"
            bordered={false}
            size="small"
            title="图片上下文"
            extra={
              <Select
                allowClear
                size="small"
                placeholder="选择图片"
                className="agent-context__select"
                value={hasSelectedImage ? currentImageId : undefined}
                onChange={(value) => setCurrentImageId(value ? Number(value) : null)}
                options={(imagesQuery.data?.items ?? []).map((item) => ({
                  value: item.id,
                  label: `#${item.id} ${item.file_name}`,
                }))}
              />
            }
          >
            {latestSnapshot ? (
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <div className="image-preview">
                  <AntImage
                    src={resolveAssetUrl(latestSnapshot.image.origin_url)}
                    width="100%"
                    style={{ borderRadius: 12, maxHeight: 160, objectFit: "cover" }}
                  />
                </div>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {latestSnapshot.image.file_name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTime(latestSnapshot.image.upload_time)}
                </Typography.Text>
              </Space>
            ) : (
              <Upload.Dragger
                className="agent-context__uploader"
                showUploadList={false}
                multiple={false}
                disabled={isUploading}
                beforeUpload={(file) => {
                  void handleUpload(file as File);
                  return Upload.LIST_IGNORE;
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">上传或选择图片进入分析</p>
              </Upload.Dragger>
            )}
          </Card>

          <Card
            className="panel-card"
            bordered={false}
            size="small"
            title="结构化结果"
            extra={
              <Space size={6}>
                {latestSnapshot?.segmentation?.overlay_url ? (
                  <Button
                    size="small"
                    onClick={() =>
                      void handleDownloadSegmentationAsset(
                        latestSnapshot.segmentation?.overlay_url,
                        "segmentation-overlay.png",
                      )
                    }
                  >
                    叠加图
                  </Button>
                ) : null}
                {latestSnapshot?.segmentation?.mask_url ? (
                  <Button
                    size="small"
                    onClick={() =>
                      void handleDownloadSegmentationAsset(
                        latestSnapshot.segmentation?.mask_url,
                        "segmentation-mask.png",
                      )
                    }
                  >
                    掩膜图
                  </Button>
                ) : null}
              </Space>
            }
          >
            {latestSnapshot ? (
              <div className="assistant-preview-grid">
                <Card
                  size="small"
                  title="矿物分类"
                  extra={<StatusTag status={latestSnapshot.classification?.status} />}
                >
                  {latestSnapshot.classification?.status === "success" ? (
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>
                        {latestSnapshot.classification.predicted_class}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        置信度：{formatConfidence(latestSnapshot.classification.confidence)}
                      </Typography.Text>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>暂无结果</Typography.Text>
                  )}
                </Card>

                <Card
                  size="small"
                  title="鲕粒分割"
                  extra={<StatusTag status={latestSnapshot.segmentation?.status} />}
                >
                  {latestSnapshot.segmentation?.status === "success" ? (
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>
                        {latestSnapshot.segmentation.grain_count ?? 0} 个鲕粒
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        占比：{formatPercent(latestSnapshot.segmentation.area_ratio)}
                      </Typography.Text>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>暂无结果</Typography.Text>
                  )}
                </Card>
              </div>
            ) : (
              <Empty
                description="绑定图片后显示结果"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: "12px 0" }}
              />
            )}
          </Card>
        </div>

        <Card
          className="panel-card agent-chat"
          bordered={false}
          title="分析对话"
          extra={
            <Space size={6}>
              {hasSelectedImage ? (
                <Tag color="processing">图片 #{currentImageId}</Tag>
              ) : (
                <Tag>普通聊天</Tag>
              )}
              {latestAssistantMessage?.status === "streaming" ? (
                <Tag color="processing">输出中</Tag>
              ) : null}
            </Space>
          }
        >
          <div className="agent-suggestions">
            {QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                size="small"
                disabled={isSending || isGeneralChatUnavailable}
                onClick={() => void sendQuestion(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>

          <div className="agent-chat__messages" ref={messagesRef}>
            {messages.length ? (
              messages.map((item) => (
                <div
                  key={item.id}
                  className={`agent-chat__message agent-chat__message--${item.role} ${
                    item.kind === "status"
                      ? "agent-chat__message--status"
                      : ""
                  } ${
                    item.status === "error"
                      ? "agent-chat__message--error"
                      : item.kind !== "status" && item.status === "streaming"
                        ? "agent-chat__message--streaming"
                        : ""
                  }`}
                >
                  {item.role === "assistant" ? (
                    <Space size="small" style={{ marginBottom: 4 }}>
                      {item.kind === "status" ? (
                        <Tag color={item.status === "error" ? "error" : "processing"}>
                          {item.status === "error" ? "异常" : "步骤"}
                        </Tag>
                      ) : item.status === "streaming" ? (
                        <>
                          <LoadingOutlined />
                          <Tag color="processing">生成中</Tag>
                        </>
                      ) : item.status === "error" ? (
                        <Tag color="error">错误</Tag>
                      ) : (
                        <Tag color="success">完成</Tag>
                      )}
                    </Space>
                  ) : null}

                  {item.role === "assistant" && item.kind !== "status" ? (
                    <MarkdownMessage content={item.content} />
                  ) : (
                    <Typography.Text
                      style={{
                        color:
                          item.role === "user"
                            ? "inherit"
                            : item.kind === "status"
                              ? "rgba(22, 51, 50, 0.78)"
                              : undefined,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.content}
                    </Typography.Text>
                  )}

                  {item.role === "assistant" &&
                  item.kind !== "status" &&
                  item.toolCalls?.length ? (
                    <AgentToolList toolCalls={item.toolCalls} />
                  ) : null}
                </div>
              ))
            ) : (
              <Empty
                description="直接聊天或上传图片进行分析"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>

          <Input.TextArea
            value={draft}
            disabled={isSending || isGeneralChatUnavailable}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder={
              isGeneralChatUnavailable
                ? "请先在「模型设置」中配置参数"
                : hasSelectedImage
                  ? "输入问题，例如：分析这张图、这是什么矿物"
                  : "直接聊天，例如：你能做什么？"
            }
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void sendQuestion(draft);
              }
            }}
          />

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              回车发送，Shift + Enter 换行
            </Typography.Text>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              loading={isSending}
              disabled={isGeneralChatUnavailable}
              onClick={() => void sendQuestion(draft)}
            >
              发送
            </Button>
          </Space>
        </Card>
      </div>

      <Modal
        title="前端模型设置"
        open={isLlmModalOpen}
        onCancel={() => setIsLlmModalOpen(false)}
        onOk={() => void handleSaveLlmSettings()}
        okText="保存配置"
        cancelText="取消"
        destroyOnClose={false}
        width={640}
        footer={[
          <Button key="reset" onClick={handleResetLlmSettings}>
            恢复默认
          </Button>,
          <Button key="cancel" onClick={() => setIsLlmModalOpen(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => void handleSaveLlmSettings()}>
            保存配置
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Typography.Text type="secondary">
            这里的配置只保存在当前浏览器本地，不会提交到 Git。保存后新的聊天请求会立即使用这组模型参数。
          </Typography.Text>

          <Form form={llmForm} layout="vertical">
            <Form.Item
              label="模型接口地址"
              name="baseUrl"
              rules={[{ required: true, message: "请输入模型接口地址" }]}
              extra="支持填写基础地址或完整的 /chat/completions 地址。"
            >
              <Input placeholder="例如 https://host/api/v1/chat/completions" />
            </Form.Item>

            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: "请输入 API Key" }]}
            >
              <Input.Password placeholder="请输入你的模型 API Key" />
            </Form.Item>

            <Form.Item
              label="模型名称"
              name="model"
              rules={[{ required: true, message: "请输入模型名称" }]}
            >
              <Input placeholder="例如 mimo-v2.5" />
            </Form.Item>
          </Form>

          <div className="agent-config__summary">
            <Typography.Text strong>当前生效配置</Typography.Text>
            <Typography.Text type="secondary">
              来源：{getConfigSourceLabel(llmConfig.source)}
            </Typography.Text>
            <Typography.Text type="secondary">
              接口：{llmConfig.llmBaseUrl || "未配置"}
            </Typography.Text>
            <Typography.Text type="secondary">
              模型：{llmConfig.llmModel || "未配置"}
            </Typography.Text>
            <Typography.Text type="secondary">
              Key：{llmConfig.llmApiKey ? maskSecret(llmConfig.llmApiKey) : "未配置"}
            </Typography.Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
};
