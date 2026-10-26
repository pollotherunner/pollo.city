package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/httpapi"
	"pollo.city/internal/store/sqlite"
	"pollo.city/internal/uploads"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration error", "error", err)
		os.Exit(1)
	}

	database, err := sqlite.New(cfg.DatabasePath)
	if err != nil {
		logger.Error("database error", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	authService := auth.New(database, cfg.AdminPassword, cfg.SessionTTL)
	handler, err := httpapi.New(cfg, database, authService, logger)
	if err != nil {
		logger.Error("server setup error", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	stopContext, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cleaner := uploads.NewCleaner(database, cfg.UploadsDir, cfg.OrphanUploadAge, logger)
	go runUploadCleanup(stopContext, cleaner, logger)

	go func() {
		logger.Info("server listening", "addr", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server stopped unexpectedly", "error", err)
			stop()
		}
	}()

	<-stopContext.Done()
	shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}

const (
	uploadCleanupInterval = 6 * time.Hour
	uploadCleanupTimeout  = 5 * time.Minute
)

func runUploadCleanup(ctx context.Context, cleaner *uploads.Cleaner, logger *slog.Logger) {
	run := func() {
		cleanupContext, cancel := context.WithTimeout(context.Background(), uploadCleanupTimeout)
		defer cancel()

		report, err := cleaner.Run(cleanupContext)
		if err != nil {
			logger.Error("orphan upload cleanup failed",
				"error", err,
				"scanned", report.Scanned,
				"deleted", report.Deleted,
				"failed", report.Failed,
			)
			return
		}

		logger.Info("orphan upload cleanup finished",
			"scanned", report.Scanned,
			"kept", report.Kept,
			"deleted", report.Deleted,
			"skipped_recent", report.SkippedRecent,
			"ignored", report.Ignored,
			"failed", report.Failed,
			"freed_bytes", report.FreedBytes,
		)
	}

	run()
	ticker := time.NewTicker(uploadCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}
