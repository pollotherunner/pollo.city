package httpapi

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxRateLimitEntries = 100_000

type rateEntry struct {
	count int
	reset time.Time
}

type rateLimiter struct {
	mu          sync.Mutex
	limit       int
	window      time.Duration
	entries     map[string]rateEntry
	lastCleanup time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		limit:   limit,
		window:  window,
		entries: make(map[string]rateEntry),
	}
}

func (l *rateLimiter) allow(key string, now time.Time) (bool, time.Duration) {
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
		if !exists && len(l.entries) >= maxRateLimitEntries {
			l.cleanup(now)
			if len(l.entries) >= maxRateLimitEntries {
				l.entries = make(map[string]rateEntry)
			}
		}
		l.entries[key] = rateEntry{count: 1, reset: now.Add(l.window)}
		return true, 0
	}
	if entry.count >= l.limit {
		return false, entry.reset.Sub(now)
	}

	entry.count += 1
	l.entries[key] = entry
	return true, 0
}

func (l *rateLimiter) reset(key string) {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

func (l *rateLimiter) cleanup(now time.Time) {
	for key, entry := range l.entries {
		if !now.Before(entry.reset) {
			delete(l.entries, key)
		}
	}
	if len(l.entries) < maxRateLimitEntries {
		return
	}

	// Bound memory if a large number of distinct clients hit the endpoint.
	l.entries = make(map[string]rateEntry)
}

func writeRateLimitError(w http.ResponseWriter, retryAfter time.Duration, message string) {
	seconds := int(retryAfter / time.Second)
	if retryAfter%time.Second != 0 {
		seconds += 1
	}
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeError(w, http.StatusTooManyRequests, message)
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
