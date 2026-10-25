package domain

import "time"

type Post struct {
	Slug      string   `json:"slug"`
	Title     string   `json:"title"`
	Excerpt   string   `json:"excerpt"`
	Tags      []string `json:"tags"`
	Date      string   `json:"date"`
	Thumbnail string   `json:"thumbnail"`
	Body      string   `json:"body"`
	Section   string   `json:"section"`
}

type Comment struct {
	ID   int64     `json:"id"`
	Name string    `json:"name"`
	Body string    `json:"body"`
	Date time.Time `json:"date"`
}

type About struct {
	Title     string `json:"title"`
	Lede      string `json:"lede"`
	Body      string `json:"body"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

type Draft struct {
	ID        string    `json:"id"`
	PostSlug  string    `json:"postSlug,omitempty"`
	Title     string    `json:"title"`
	Excerpt   string    `json:"excerpt"`
	Tags      []string  `json:"tags"`
	Thumbnail string    `json:"thumbnail"`
	Body      string    `json:"body"`
	Section   string    `json:"section"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Tag struct {
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Count int    `json:"count"`
}

type BackupComment struct {
	PostSlug string    `json:"postSlug"`
	Name     string    `json:"name"`
	Body     string    `json:"body"`
	Date     time.Time `json:"date"`
}

type Backup struct {
	Version    int             `json:"version"`
	ExportedAt time.Time       `json:"exportedAt"`
	Posts      []Post          `json:"posts"`
	Comments   []BackupComment `json:"comments"`
	Drafts     []Draft         `json:"drafts"`
	About      *About          `json:"about,omitempty"`
}
