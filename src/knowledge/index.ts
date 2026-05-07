import minerals from "./data/minerals.json";
import rockTypes from "./data/rock_types.json";
import thinSectionGuides from "./data/thin_section_guides.json";
import opticalProperties from "./data/optical_properties.json";
import glossary from "./data/glossary.json";
import type { KnowledgeEntry, KnowledgeCategory } from "./types";
import { initializeSearch, searchKnowledge } from "./search";

const ALL_ENTRIES: KnowledgeEntry[] = [
  ...(minerals as KnowledgeEntry[]),
  ...(rockTypes as KnowledgeEntry[]),
  ...(thinSectionGuides as KnowledgeEntry[]),
  ...(opticalProperties as KnowledgeEntry[]),
  ...(glossary as KnowledgeEntry[]),
];

let initialized = false;

export function ensureKnowledgeReady(): void {
  if (!initialized) {
    initializeSearch(ALL_ENTRIES);
    initialized = true;
  }
}

/** Search knowledge and return formatted context for LLM injection. */
export function retrieveKnowledgeContext(
  query: string,
  maxResults: number = 3,
): string {
  ensureKnowledgeReady();
  const entries = searchKnowledge(query, maxResults);

  if (entries.length === 0) {
    return "";
  }

  return entries
    .map((entry) => `### ${entry.title}\n${entry.content}`)
    .join("\n\n---\n\n");
}

export function getAllKnowledgeEntries(): KnowledgeEntry[] {
  return ALL_ENTRIES;
}

export function getKnowledgeByCategory(
  category: KnowledgeCategory,
): KnowledgeEntry[] {
  return ALL_ENTRIES.filter((e) => e.category === category);
}

export function getKnowledgeById(id: string): KnowledgeEntry | undefined {
  return ALL_ENTRIES.find((e) => e.id === id);
}

export { searchKnowledge };
export type { KnowledgeEntry, KnowledgeCategory } from "./types";
export { CATEGORY_LABELS } from "./types";
