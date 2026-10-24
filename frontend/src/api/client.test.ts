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
