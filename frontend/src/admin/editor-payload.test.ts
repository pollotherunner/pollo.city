import { describe, expect, it } from "vitest";
import type { PostInput } from "@/api/types";
import { toDraftInput } from "./editor-payload";

describe("editor payloads", () => {
  it("adds postSlug only to draft payloads", () => {
    const content: PostInput = {
      title: "Título",
      excerpt: "Resumo",
      tags: ["Teste"],
      thumbnail: "/uploads/image.png",
      body: "Conteúdo",
      section: "article",
      audio: "/uploads/audio.mp3",
    };

    expect(toDraftInput(content, "meu-artigo")).toEqual({
      ...content,
      postSlug: "meu-artigo",
    });
    expect(toDraftInput(content, "meu-artigo", "2026-10-26T12:00:00Z")).toEqual({
      ...content,
      postSlug: "meu-artigo",
      expectedUpdatedAt: "2026-10-26T12:00:00Z",
    });
    expect("postSlug" in content).toBe(false);
  });

  it("uses an empty post slug for new drafts", () => {
    const content: PostInput = {
      title: "Título",
      excerpt: "",
      tags: [],
      thumbnail: "",
      body: "Conteúdo",
      section: "off-topic",
      audio: "",
    };
    expect(toDraftInput(content, null).postSlug).toBe("");
  });
});
