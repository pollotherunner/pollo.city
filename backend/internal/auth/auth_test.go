package auth

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"pollo.city/internal/store/sqlite"
)

func TestPasswordChangeInvalidatesExistingSessions(t *testing.T) {
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	ctx := context.Background()
	first := New(database, "primeira-senha", time.Hour)
	token, _, err := first.Login(ctx, "primeira-senha")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	authenticated, err := first.Authenticate(ctx, token)
	if err != nil || !authenticated {
		t.Fatalf("expected first session to be valid: %v", err)
	}

	second := New(database, "segunda-senha", time.Hour)
	authenticated, err = second.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("authenticate after password change: %v", err)
	}
	if authenticated {
		t.Fatal("session from the old password should be invalid")
	}

	newToken, _, err := second.Login(ctx, "segunda-senha")
	if err != nil {
		t.Fatalf("login with new password: %v", err)
	}
	authenticated, err = second.Authenticate(ctx, newToken)
	if err != nil || !authenticated {
		t.Fatalf("expected new session to be valid: %v", err)
	}
}
