-- Preserve older duplicate drafts as unlinked drafts instead of deleting them.
UPDATE drafts
SET post_id = NULL
WHERE post_id IS NOT NULL
  AND id <> (
    SELECT d2.id
    FROM drafts d2
    WHERE d2.post_id = drafts.post_id
    ORDER BY julianday(d2.updated_at) DESC, d2.rowid DESC
    LIMIT 1
  );
