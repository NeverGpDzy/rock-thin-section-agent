import { BookOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Card,
  Collapse,
  Empty,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import {
  getAllKnowledgeEntries,
  searchKnowledge,
  CATEGORY_LABELS,
} from "@/knowledge";
import type { KnowledgeCategory } from "@/knowledge";
import { MarkdownMessage } from "@/components/MarkdownMessage";

const ALL_CATEGORIES: KnowledgeCategory[] = [
  "mineral",
  "rock_type",
  "thin_section",
  "optical_property",
  "glossary",
];

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  mineral: "green",
  rock_type: "orange",
  thin_section: "blue",
  optical_property: "purple",
  glossary: "default",
};

export const KnowledgePage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    KnowledgeCategory | "all"
  >("all");

  const filteredEntries = useMemo(() => {
    let entries = searchQuery.trim()
      ? searchKnowledge(searchQuery, 50)
      : getAllKnowledgeEntries();

    if (selectedCategory !== "all") {
      entries = entries.filter((e) => e.category === selectedCategory);
    }

    return entries;
  }, [searchQuery, selectedCategory]);

  const collapseItems = useMemo(
    () =>
      filteredEntries.map((entry) => ({
        key: entry.id,
        label: (
          <Space>
            <Typography.Text strong>{entry.title}</Typography.Text>
            <Tag color={CATEGORY_COLORS[entry.category]}>
              {CATEGORY_LABELS[entry.category]}
            </Tag>
            {entry.tags.slice(0, 2).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ),
        children: <MarkdownMessage content={entry.content} />,
      })),
    [filteredEntries],
  );

  return (
    <div style={{ padding: "0 0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Typography.Title level={4} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 8 }} />
            岩石矿物知识库
          </Typography.Title>
          <Input
            placeholder="搜索矿物、岩石、光性概念..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="large"
          />
          <Space wrap>
            <Tag
              color={selectedCategory === "all" ? "#17594a" : undefined}
              style={{ cursor: "pointer", padding: "4px 12px" }}
              onClick={() => setSelectedCategory("all")}
            >
              全部
            </Tag>
            {ALL_CATEGORIES.map((cat) => (
              <Tag
                key={cat}
                color={
                  selectedCategory === cat
                    ? CATEGORY_COLORS[cat]
                    : undefined
                }
                style={{ cursor: "pointer", padding: "4px 12px" }}
                onClick={() => setSelectedCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>

      {filteredEntries.length === 0 ? (
        <Empty description="未找到匹配的知识条目" />
      ) : (
        <Collapse
          items={collapseItems}
          ghost
          style={{ background: "transparent" }}
        />
      )}
    </div>
  );
};
