export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function countWords(value: string): number {
  const clean = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_~\-\[\]()]/g, " ")
    .trim();
  return clean ? clean.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length : 0;
}

export function readingMinutes(value: string): number {
  return Math.max(1, Math.ceil(countWords(value) / 210));
}

export function initials(name: string): string {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (!pieces.length) {
    return "?";
  }
  if (pieces.length === 1) {
    return (pieces[0] ?? "").slice(0, 2).toUpperCase();
  }
  const first = pieces[0] ?? "";
  const last = pieces[pieces.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
