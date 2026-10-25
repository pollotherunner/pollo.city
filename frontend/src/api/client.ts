import type {
  About,
  AboutInput,
  AboutResponse,
  Backup,
  Comment,
  CommentInput,
  CommentListResponse,
  CommentResponse,
  Draft,
  DraftInput,
  DraftListResponse,
  DraftResponse,
  Post,
  PostInput,
  PostListResponse,
  PostResponse,
  Tag,
  TagListResponse,
  UploadResponse,
} from "./types";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

interface SessionResponse {
  authenticated: boolean;
}

interface LoginResponse {
  ok: boolean;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return null;
  }
  return typeof payload.error === "string" ? payload.error : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class ApiClient {
  private postsCache: Post[] | null = null;
  private tagsCache: Tag[] | null = null;
  private aboutCache: About | null = null;

  constructor(
    private readonly baseUrl = "/api",
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const requestInit: RequestInit = {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, requestInit);
    } catch {
      throw new ApiError("Não foi possível conectar ao servidor.", 0);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await readJson(response);
    if (!response.ok) {
      throw new ApiError(errorMessage(payload) ?? "Não foi possível concluir a operação.", response.status);
    }
    return payload as T;
  }

  private invalidateContent(): void {
    this.postsCache = null;
    this.tagsCache = null;
  }

  private invalidateAll(): void {
    this.invalidateContent();
    this.aboutCache = null;
  }

  async getPosts(force = false): Promise<Post[]> {
    if (!force && this.postsCache) {
      return this.postsCache;
    }
    const payload = await this.request<PostListResponse>("/posts");
    this.postsCache = payload.posts;
    return this.postsCache;
  }

  async getPost(slug: string): Promise<Post | null> {
    const posts = await this.getPosts();
    return posts.find((post) => post.slug === slug) ?? null;
  }

  async getTags(force = false): Promise<Tag[]> {
    if (!force && this.tagsCache) {
      return this.tagsCache;
    }
    const payload = await this.request<TagListResponse>("/tags");
    this.tagsCache = payload.tags;
    return this.tagsCache;
  }

  async getAbout(force = false): Promise<About> {
    if (!force && this.aboutCache) {
      return this.aboutCache;
    }
    const payload = await this.request<AboutResponse>("/about");
    this.aboutCache = payload.about;
    return this.aboutCache;
  }

  async getComments(slug: string): Promise<Comment[]> {
    const payload = await this.request<CommentListResponse>(`/posts/${encodeURIComponent(slug)}/comments`);
    return payload.comments;
  }

  async addComment(slug: string, input: CommentInput): Promise<Comment> {
    const payload = await this.request<CommentResponse>(`/posts/${encodeURIComponent(slug)}/comments`, {
      method: "POST",
      body: input,
    });
    return payload.comment;
  }

  async login(password: string): Promise<void> {
    await this.request<LoginResponse>("/admin/login", {
      method: "POST",
      body: { password },
    });
    this.invalidateAll();
  }

  async logout(): Promise<void> {
    await this.request<undefined>("/admin/logout", { method: "POST" });
    this.invalidateAll();
  }

  async getSession(): Promise<boolean> {
    const payload = await this.request<SessionResponse>("/admin/session");
    return payload.authenticated;
  }

  async createPost(input: PostInput): Promise<Post> {
    const payload = await this.request<PostResponse>("/admin/posts", {
      method: "POST",
      body: input,
    });
    this.invalidateContent();
    return payload.post;
  }

  async updatePost(slug: string, input: PostInput): Promise<Post> {
    const payload = await this.request<PostResponse>(`/admin/posts/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: input,
    });
    this.invalidateContent();
    return payload.post;
  }

  async deletePost(slug: string): Promise<void> {
    await this.request<undefined>(`/admin/posts/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    this.invalidateContent();
  }

  async getDrafts(): Promise<Draft[]> {
    const payload = await this.request<DraftListResponse>("/admin/drafts");
    return payload.drafts;
  }

  async getDraftForPost(slug: string): Promise<Draft | null> {
    const drafts = await this.getDrafts();
    return drafts.find((draft) => draft.postSlug === slug) ?? null;
  }

  async createDraft(input: DraftInput): Promise<Draft> {
    const payload = await this.request<DraftResponse>("/admin/drafts", {
      method: "POST",
      body: input,
    });
    return payload.draft;
  }

  async updateDraft(id: string, input: DraftInput): Promise<Draft> {
    const payload = await this.request<DraftResponse>(`/admin/drafts/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
    });
    return payload.draft;
  }

  async deleteDraft(id: string): Promise<void> {
    await this.request<undefined>(`/admin/drafts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async updateAbout(input: AboutInput): Promise<About> {
    const payload = await this.request<AboutResponse>("/admin/about", {
      method: "PUT",
      body: input,
    });
    this.aboutCache = payload.about;
    return payload.about;
  }

  async uploadImage(file: File | Blob): Promise<string> {
    return this.uploadFile("/admin/uploads", file, "Não foi possível enviar a imagem.");
  }

  async uploadAudio(file: File | Blob, waveform?: number[]): Promise<string> {
    return this.uploadFile("/admin/uploads/audio", file, "Não foi possível enviar o áudio.", waveform);
  }

  private async uploadFile(
    path: string,
    file: File | Blob,
    errorText: string,
    waveform?: number[],
  ): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    if (waveform?.length) {
      form.append("waveform", JSON.stringify(waveform));
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new ApiError(errorText, 0);
    }

    const payload = await readJson(response);
    if (!response.ok) {
      throw new ApiError(errorMessage(payload) ?? errorText, response.status);
    }
    return (payload as UploadResponse).url;
  }

  async exportBackup(): Promise<Backup> {
    return this.request<Backup>("/admin/export");
  }

  async importBackup(backup: Backup): Promise<void> {
    await this.request<undefined>("/admin/import", {
      method: "POST",
      body: backup,
    });
    this.invalidateAll();
  }
}

export const api = new ApiClient();
