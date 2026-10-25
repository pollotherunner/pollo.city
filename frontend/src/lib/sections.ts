import type { Section } from "@/api/types";

export const SECTION_LABELS: Record<Section, string> = {
  article: "Artigo",
  "off-topic": "Off-Topic",
};

export function sectionLabel(section: Section | undefined): string {
  return section === "off-topic" ? SECTION_LABELS["off-topic"] : SECTION_LABELS.article;
}

export function isOffTopic(section: Section | undefined): boolean {
  return section === "off-topic";
}
