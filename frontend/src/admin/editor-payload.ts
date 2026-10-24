import type { DraftInput, PostInput } from "@/api/types";

export function toDraftInput(content: PostInput, postSlug: string | null): DraftInput {
  return {
    ...content,
    postSlug: postSlug ?? "",
  };
}
