const MAX_TAGS = 8;

function normalizeTag(value: string): string {
  return value
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

export function tagSlug(value: string): string {
  return normalizeTag(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTags(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    const tag = normalizeTag(value);
    const slug = tagSlug(tag);
    if (!tag || !slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    tags.push(tag);
    if (tags.length === MAX_TAGS) {
      break;
    }
  }

  return tags;
}

export { MAX_TAGS };
