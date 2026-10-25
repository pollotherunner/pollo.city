package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const maxCommentRateLimitEntries = 100_000

type commentRateEntry struct {
	count int
	reset time.Time
}

type commentLimiter struct {
	mu          sync.Mutex
	limit       int
	window      time.Duration
	entries     map[string]commentRateEntry
	lastCleanup time.Time
}

func newCommentLimiter(limit int, window time.Duration) *commentLimiter {
	return &commentLimiter{
		limit:   limit,
		window:  window,
		entries: make(map[string]commentRateEntry),
	}
}

func (l *commentLimiter) allow(key string, now time.Time) (bool, time.Duration) {
	if l == nil || l.limit <= 0 || l.window <= 0 {
		return true, 0
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if l.lastCleanup.IsZero() || now.Sub(l.lastCleanup) >= l.window {
		l.cleanup(now)
		l.lastCleanup = now
	}

	entry, exists := l.entries[key]
	if !exists || !now.Before(entry.reset) {
		l.entries[key] = commentRateEntry{count: 1, reset: now.Add(l.window)}
		return true, 0
	}
	if entry.count >= l.limit {
		return false, entry.reset.Sub(now)
	}

	entry.count += 1
	l.entries[key] = entry
	return true, 0
}

func (l *commentLimiter) cleanup(now time.Time) {
	for key, entry := range l.entries {
		if !now.Before(entry.reset) {
			delete(l.entries, key)
		}
	}
	if len(l.entries) < maxCommentRateLimitEntries {
		return
	}

	// Bound memory if a large number of distinct clients hit the endpoint.
	l.entries = make(map[string]commentRateEntry)
}

func clientRateLimitKey(r *http.Request) string {
	remoteAddress := strings.TrimSpace(r.RemoteAddr)
	host, _, err := net.SplitHostPort(remoteAddress)
	if err == nil {
		remoteAddress = host
	}

	remoteIP := net.ParseIP(remoteAddress)
	if remoteIP == nil {
		return remoteAddress
	}
	if !isTrustedProxy(remoteIP) {
		return rateLimitIPKey(remoteIP)
	}

	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		for index := len(parts) - 1; index >= 0; index -= 1 {
			if ip := net.ParseIP(strings.TrimSpace(parts[index])); ip != nil {
				return rateLimitIPKey(ip)
			}
		}
	}

	return rateLimitIPKey(remoteIP)
}

func isTrustedProxy(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

func rateLimitIPKey(ip net.IP) string {
	if ipv4 := ip.To4(); ipv4 != nil {
		return ipv4.String()
	}
	return ip.Mask(net.CIDRMask(64, 128)).String()
}
