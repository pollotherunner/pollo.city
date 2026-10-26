package httpapi

import (
	"log/slog"
	"net/http"
	"net/url"
	"runtime/debug"
	"strings"
	"time"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(body []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(body)
}

func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		writer := &statusWriter{ResponseWriter: w}
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("X-Frame-Options", "DENY")
		writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		writer.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		if !sameOriginRequest(r) {
			writeError(writer, http.StatusForbidden, "cross-origin request blocked")
			return
		}

		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("panic recovered", "panic", recovered, "stack", string(debug.Stack()))
				writeError(writer, http.StatusInternalServerError, "internal error")
			}
			s.logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", writer.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"remote", r.RemoteAddr,
			)
		}()

		next.ServeHTTP(writer, r)
	})
}

func sameOriginRequest(r *http.Request) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return true
	}
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("Sec-Fetch-Site")), "cross-site") {
		return false
	}

	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" || origin == "null" {
		return origin == ""
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	requestScheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		requestScheme = "https"
	}
	return strings.EqualFold(parsed.Host, r.Host) && strings.EqualFold(parsed.Scheme, requestScheme)
}

func (s *Server) logError(message string, err error) {
	s.logger.Error(message, slog.String("error", err.Error()))
}
