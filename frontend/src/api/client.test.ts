import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

describe("ApiClient", () => {
  it("caches public posts until explicitly refreshed", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ posts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new ApiClient("/api", fetcher as unknown as typeof fetch);

    await client.getPosts();
    await client.getPosts();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("loads a single post by slug and treats 404 as null", async () => {
    const post = {
      slug: "artigo",
      title: "Artigo",
      excerpt: "",
      tags: [],
      date: "2026-10-26",
      thumbnail: "",
      body: "Conteúdo",
      section: "article" as const,
      audio: "",
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ post }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new ApiClient("/api", fetcher as unknown as typeof fetch);

    await expect(client.getPost("artigo")).resolves.toEqual(post);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/posts/artigo", expect.anything());
    await expect(client.getPost("sumiu")).resolves.toBeNull();
  });

  it("exposes server errors as ApiError", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new ApiClient("/api", fetcher as unknown as typeof fetch);

    await expect(client.getPosts()).rejects.toMatchObject({
      name: "ApiError",
      message: "invalid request body",
      status: 400,
    });
  });
});
