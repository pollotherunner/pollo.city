package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	HTTPAddr            string
	DatabasePath        string
	UploadsDir          string
	PublicDir           string
	AdminPassword       string
	SessionTTL          time.Duration
	CookieSecure        bool
	MaxUploadBytes      int64
	MaxAudioUploadBytes int64
	OrphanUploadAge     time.Duration
	CommentRateLimit    int
	CommentRateWindow   time.Duration
	LoginRateLimit      int
	LoginRateWindow     time.Duration
}

func Load() (Config, error) {
	_ = godotenv.Load()

	sessionTTL := 24 * time.Hour
	if value := strings.TrimSpace(os.Getenv("SESSION_TTL")); value != "" {
		parsed, err := time.ParseDuration(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse SESSION_TTL: %w", err)
		}
		sessionTTL = parsed
	}

	cookieSecure := true
	if value := strings.TrimSpace(os.Getenv("COOKIE_SECURE")); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse COOKIE_SECURE: %w", err)
		}
		cookieSecure = parsed
	}

	maxUploadMB := 8
	if value := strings.TrimSpace(os.Getenv("MAX_UPLOAD_MB")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse MAX_UPLOAD_MB: %w", err)
		}
		maxUploadMB = parsed
	}

	maxAudioUploadMB := 32
	if value := strings.TrimSpace(os.Getenv("MAX_AUDIO_UPLOAD_MB")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse MAX_AUDIO_UPLOAD_MB: %w", err)
		}
		maxAudioUploadMB = parsed
	}

	orphanUploadAge := 24 * time.Hour
	if value := strings.TrimSpace(os.Getenv("ORPHAN_UPLOAD_AGE")); value != "" {
		parsed, err := time.ParseDuration(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse ORPHAN_UPLOAD_AGE: %w", err)
		}
		orphanUploadAge = parsed
	}

	commentRateLimit := 5
	if value := strings.TrimSpace(os.Getenv("COMMENT_RATE_LIMIT")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse COMMENT_RATE_LIMIT: %w", err)
		}
		commentRateLimit = parsed
	}

	commentRateWindow := 10 * time.Minute
	if value := strings.TrimSpace(os.Getenv("COMMENT_RATE_WINDOW")); value != "" {
		parsed, err := time.ParseDuration(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse COMMENT_RATE_WINDOW: %w", err)
		}
		commentRateWindow = parsed
	}

	loginRateLimit := 10
	if value := strings.TrimSpace(os.Getenv("LOGIN_RATE_LIMIT")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse LOGIN_RATE_LIMIT: %w", err)
		}
		loginRateLimit = parsed
	}

	loginRateWindow := 15 * time.Minute
	if value := strings.TrimSpace(os.Getenv("LOGIN_RATE_WINDOW")); value != "" {
		parsed, err := time.ParseDuration(value)
		if err != nil {
			return Config{}, fmt.Errorf("parse LOGIN_RATE_WINDOW: %w", err)
		}
		loginRateWindow = parsed
	}

	cfg := Config{
		HTTPAddr:            env("HTTP_ADDR", ":8080"),
		DatabasePath:        env("DATABASE_PATH", "data/pollo.db"),
		UploadsDir:          env("UPLOADS_DIR", "data/uploads"),
		PublicDir:           env("PUBLIC_DIR", "dist"),
		AdminPassword:       strings.TrimSpace(os.Getenv("ADMIN_PASSWORD")),
		SessionTTL:          sessionTTL,
		CookieSecure:        cookieSecure,
		MaxUploadBytes:      int64(maxUploadMB) * 1024 * 1024,
		MaxAudioUploadBytes: int64(maxAudioUploadMB) * 1024 * 1024,
		OrphanUploadAge:     orphanUploadAge,
		CommentRateLimit:    commentRateLimit,
		CommentRateWindow:   commentRateWindow,
		LoginRateLimit:      loginRateLimit,
		LoginRateWindow:     loginRateWindow,
	}

	if cfg.AdminPassword == "" {
		return Config{}, fmt.Errorf("ADMIN_PASSWORD is required")
	}
	if len(cfg.AdminPassword) < 8 {
		return Config{}, fmt.Errorf("ADMIN_PASSWORD must have at least 8 characters")
	}
	if cfg.SessionTTL <= 0 {
		return Config{}, fmt.Errorf("SESSION_TTL must be positive")
	}
	if cfg.MaxUploadBytes <= 0 {
		return Config{}, fmt.Errorf("MAX_UPLOAD_MB must be positive")
	}
	if cfg.MaxAudioUploadBytes <= 0 {
		return Config{}, fmt.Errorf("MAX_AUDIO_UPLOAD_MB must be positive")
	}
	if cfg.OrphanUploadAge < time.Hour {
		return Config{}, fmt.Errorf("ORPHAN_UPLOAD_AGE must be at least 1h")
	}
	if cfg.CommentRateLimit < 0 {
		return Config{}, fmt.Errorf("COMMENT_RATE_LIMIT must be zero or positive")
	}
	if cfg.CommentRateWindow <= 0 {
		return Config{}, fmt.Errorf("COMMENT_RATE_WINDOW must be positive")
	}
	if cfg.LoginRateLimit < 0 {
		return Config{}, fmt.Errorf("LOGIN_RATE_LIMIT must be zero or positive")
	}
	if cfg.LoginRateWindow <= 0 {
		return Config{}, fmt.Errorf("LOGIN_RATE_WINDOW must be positive")
	}

	return cfg, nil
}

func env(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
