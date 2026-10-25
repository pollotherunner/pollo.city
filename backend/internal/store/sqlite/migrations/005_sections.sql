ALTER TABLE posts ADD COLUMN section TEXT NOT NULL DEFAULT 'article';
ALTER TABLE drafts ADD COLUMN section TEXT NOT NULL DEFAULT 'article';

CREATE INDEX idx_posts_section_published_at ON posts(section, published_at DESC);
