CREATE TABLE about (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL,
    lede TEXT NOT NULL,
    body_markdown TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);
