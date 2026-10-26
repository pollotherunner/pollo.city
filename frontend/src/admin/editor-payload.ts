import type { DraftInput, PostInput } from "@/api/types";

export function toDraftInput(
  content: PostInput,
  postSlug: string | null,
  expectedUpdatedAt: string | null = null,
): DraftInput {
  const draft: DraftInput = {
    ...content,
    postSlug: postSlug ?? "",
  };
  if (expectedUpdatedAt) {
    draft.expectedUpdatedAt = expectedUpdatedAt;
  }
  return draft;
}
