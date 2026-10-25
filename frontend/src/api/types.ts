export type Section = "article" | "off-topic";

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  date: string;
  thumbnail: string;
  body: string;
  section: Section;
}

export interface Comment {
  id: number;
  name: string;
  body: string;
  date: string;
}

export interface Draft {
  id: string;
  postSlug?: string;
  title: string;
  excerpt: string;
  tags: string[];
  thumbnail: string;
  body: string;
  section: Section;
  updatedAt: string;
}

export interface Tag {
  name: string;
  slug: string;
  count: number;
}

export interface About {
  title: string;
  lede: string;
  body: string;
  updatedAt?: string;
}

export interface BackupComment {
  postSlug: string;
  name: string;
  body: string;
  date: string;
}

export interface Backup {
  version: number;
  exportedAt: string;
  posts: Post[];
  comments: BackupComment[];
  drafts: Draft[];
  about?: About;
}

export interface PostInput {
  title: string;
  excerpt: string;
  tags: string[];
  thumbnail: string;
  body: string;
  section: Section;
}

export interface DraftInput {
  postSlug: string;
  title: string;
  excerpt: string;
  tags: string[];
  thumbnail: string;
  body: string;
  section: Section;
}

export interface CommentInput {
  name: string;
  body: string;
}

export interface AboutInput {
  title: string;
  lede: string;
  body: string;
}

export interface PostListResponse {
  posts: Post[];
}

export interface PostResponse {
  post: Post;
}

export interface TagListResponse {
  tags: Tag[];
}

export interface CommentListResponse {
  comments: Comment[];
}

export interface CommentResponse {
  comment: Comment;
}

export interface DraftListResponse {
  drafts: Draft[];
}

export interface DraftResponse {
  draft: Draft;
}

export interface AboutResponse {
  about: About;
}

export interface UploadResponse {
  url: string;
}
