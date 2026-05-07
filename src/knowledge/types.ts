export type KnowledgeCategory =
  | "mineral"
  | "rock_type"
  | "thin_section"
  | "optical_property"
  | "glossary";

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  aliases: string[];
  keywords: string[];
  content: string;
  tags: string[];
}

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  mineral: "矿物",
  rock_type: "岩石类型",
  thin_section: "薄片鉴定",
  optical_property: "光性概念",
  glossary: "术语",
};
