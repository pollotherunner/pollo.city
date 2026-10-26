package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCommentLimiterWindow(t *testing.T) {
	limiter := newRateLimiter(2, time.Minute)
	now := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)

	if allowed, _ := limiter.allow("203.0.113.10", now); !allowed {
		t.Fatal("first comment should be allowed")
	}
	if allowed, _ := limiter.allow("203.0.113.10", now.Add(10*time.Second)); !allowed {
		t.Fatal("second comment should be allowed")
	}
	allowed, retryAfter := limiter.allow("203.0.113.10", now.Add(20*time.Second))
	if allowed {
		t.Fatal("third comment should be blocked")
	}
	if retryAfter <= 0 || retryAfter > time.Minute {
		t.Fatalf("unexpected retry window: %s", retryAfter)
	}
	if allowed, _ := limiter.allow("203.0.113.10", now.Add(time.Minute)); !allowed {
		t.Fatal("comment should be allowed after the window")
	}
}

func TestCommentLimiterCanBeDisabled(t *testing.T) {
	limiter := newRateLimiter(0, time.Minute)
	now := time.Now()
	for index := 0; index < 10; index += 1 {
		if allowed, _ := limiter.allow("203.0.113.10", now); !allowed {
			t.Fatal("disabled limiter should allow every comment")
		}
	}
}

func TestClientRateLimitKey(t *testing.T) {
	publicRequest := httptest.NewRequest(http.MethodPost, "/", nil)
	publicRequest.RemoteAddr = "203.0.113.10:4321"
	publicRequest.Header.Set("X-Forwarded-For", "198.51.100.5")
	if key := clientRateLimitKey(publicRequest); key != "203.0.113.10" {
		t.Fatalf("forwarded header from a public peer was trusted: %q", key)
	}

	proxyRequest := httptest.NewRequest(http.MethodPost, "/", nil)
	proxyRequest.RemoteAddr = "192.168.1.5:4321"
	proxyRequest.Header.Set("X-Forwarded-For", "198.51.100.5, 203.0.113.9")
	if key := clientRateLimitKey(proxyRequest); key != "203.0.113.9" {
		t.Fatalf("unexpected forwarded client key: %q", key)
	}

	ipv6Request := httptest.NewRequest(http.MethodPost, "/", nil)
	ipv6Request.RemoteAddr = "[2001:db8:abcd:1234::1]:4321"
	otherIPv6Request := httptest.NewRequest(http.MethodPost, "/", nil)
	otherIPv6Request.RemoteAddr = "[2001:db8:abcd:1234::2]:4321"
	if first, second := clientRateLimitKey(ipv6Request), clientRateLimitKey(otherIPv6Request); first != second {
		t.Fatalf("IPv6 addresses from the same /64 should share a key: %q != %q", first, second)
	}
}
