package sqlite

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/unicode/norm"
)

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

type normalizedTag struct {
	Name string
	Slug string
}

func nowString() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func timeString(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func parseStoredTime(value string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, value)
}

func dateOnly(value time.Time) string {
	return value.In(time.Local).Format("2006-01-02")
}

func parseDateOnly(value string) (time.Time, error) {
	date, err := time.ParseInLocation("2006-01-02", value, time.Local)
	if err != nil {
		return time.Time{}, err
	}
	return date.Add(12 * time.Hour), nil
}

func slugify(value string, fallback string, max int) string {
	decomposed := norm.NFD.String(strings.ToLower(strings.TrimSpace(value)))
	var builder strings.Builder
	for _, character := range decomposed {
		if character >= '\u0300' && character <= '\u036f' {
			continue
		}
		builder.WriteRune(character)
	}
	slug := nonSlug.ReplaceAllString(builder.String(), "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > max {
		slug = strings.Trim(slug[:max], "-")
	}
	if slug == "" {
		return fallback
	}
	return slug
}

func normalizeTags(values []string) []normalizedTag {
	tags := make([]normalizedTag, 0, len(values))
	seen := make(map[string]struct{}, len(values))

	for _, value := range values {
		name := strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(value), "#"))
		name = strings.Join(strings.Fields(name), " ")
		runes := []rune(name)
		if len(runes) > 24 {
			name = strings.TrimSpace(string(runes[:24]))
		}
		slug := slugify(name, "", 40)
		if name == "" || slug == "" {
			continue
		}
		if _, exists := seen[slug]; exists {
			continue
		}
		seen[slug] = struct{}{}
		tags = append(tags, normalizedTag{Name: name, Slug: slug})
		if len(tags) == 8 {
			break
		}
	}

	return tags
}

func excerptFromMarkdown(body string) string {
	text := regexp.MustCompile("```[\\s\\S]*?```").ReplaceAllString(body, " ")
	text = regexp.MustCompile("[#>*_`\\[\\]()]").ReplaceAllString(text, "")
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	if len([]rune(text)) <= 150 {
		return text
	}
	runes := []rune(text)
	return strings.TrimSpace(string(runes[:150])) + "…"
}

func randomID(bytesCount int) (string, error) {
	buffer := make([]byte, bytesCount)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate random id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
