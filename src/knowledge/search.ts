import Fuse, { type IFuseOptions } from "fuse.js";
import type { KnowledgeEntry } from "./types";

const FUSE_OPTIONS: IFuseOptions<KnowledgeEntry> = {
  keys: [
    { name: "title", weight: 0.35 },
    { name: "aliases", weight: 0.30 },
    { name: "keywords", weight: 0.25 },
    { name: "content", weight: 0.10 },
  ],
  threshold: 0.6,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

let fuseInstance: Fuse<KnowledgeEntry> | null = null;

export function initializeSearch(entries: KnowledgeEntry[]): void {
  fuseInstance = new Fuse(entries, FUSE_OPTIONS);
}

export function searchKnowledge(
  query: string,
  maxResults: number = 5,
): KnowledgeEntry[] {
  if (!fuseInstance) {
    return [];
  }

  const results = fuseInstance.search(query, { limit: maxResults });
  return results.map((r) => r.item);
}
