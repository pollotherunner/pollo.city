package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pollo.city/internal/auth"
	"pollo.city/internal/config"
	"pollo.city/internal/store/sqlite"
)

func TestValidateAudioURLs(t *testing.T) {
	valid := postRequest{Title: "Artigo", Body: "Conteúdo", Audio: "/uploads/audio.mp3"}
	if !validatePost(httptest.NewRecorder(), valid) {
		t.Fatal("expected uploaded audio URL to be valid")
	}

	invalid := valid
	invalid.Audio = "https://example.com/audio.mp3"
	if validatePost(httptest.NewRecorder(), invalid) {
		t.Fatal("expected external audio URL to be rejected")
	}

	if !validateDraft(httptest.NewRecorder(), draftRequest{Title: "Rascunho", Audio: "/uploads/audio.ogg"}) {
		t.Fatal("expected uploaded draft audio URL to be valid")
	}
}

func TestUploadAudio(t *testing.T) {
	database, err := sqlite.New(filepath.Join(t.TempDir(), "pollo.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer database.Close()

	uploadsDir := t.TempDir()
	cfg := config.Config{
		PublicDir:           t.TempDir(),
		UploadsDir:          uploadsDir,
		SessionTTL:          time.Hour,
		MaxAudioUploadBytes: 1 << 20,
	}
	server, err := New(cfg, database, auth.New(database, "password123", time.Hour), slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	handler := server.Handler()

	login := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(`{"password":"password123"}`))
	login.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()
	handler.ServeHTTP(loginRecorder, login)
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status: %d", loginRecorder.Code)
	}
	cookies := loginRecorder.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("login did not set a session cookie")
	}

	audio := append([]byte("ID3"), bytes.Repeat([]byte{0}, 128)...)
	waveform := make([]int, 64)
	for index := range waveform {
		waveform[index] = index
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	waveformJSON, err := json.Marshal(waveform)
	if err != nil {
		t.Fatalf("encode waveform: %v", err)
	}
	if err := writer.WriteField("waveform", string(waveformJSON)); err != nil {
		t.Fatalf("write waveform field: %v", err)
	}
	part, err := writer.CreateFormFile("file", "artigo.mp3")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(audio); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/admin/uploads/audio", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.AddCookie(cookies[0])
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.HasPrefix(response.URL, "/uploads/") || !strings.HasSuffix(response.URL, ".mp3") {
		t.Fatalf("unexpected audio URL: %q", response.URL)
	}

	fileRequest := httptest.NewRequest(http.MethodGet, response.URL, nil)
	fileRecorder := httptest.NewRecorder()
	handler.ServeHTTP(fileRecorder, fileRequest)
	if fileRecorder.Code != http.StatusOK {
		t.Fatalf("serve uploaded audio: %d", fileRecorder.Code)
	}
	if !bytes.Equal(fileRecorder.Body.Bytes(), audio) {
		t.Fatal("served audio does not match upload")
	}

	waveformRequest := httptest.NewRequest(http.MethodGet, strings.TrimSuffix(response.URL, ".mp3")+".json", nil)
	waveformRecorder := httptest.NewRecorder()
	handler.ServeHTTP(waveformRecorder, waveformRequest)
	if waveformRecorder.Code != http.StatusOK {
		t.Fatalf("serve uploaded waveform: %d", waveformRecorder.Code)
	}
	var servedWaveform []int
	if err := json.Unmarshal(waveformRecorder.Body.Bytes(), &servedWaveform); err != nil {
		t.Fatalf("decode waveform: %v", err)
	}
	if len(servedWaveform) != len(waveform) || servedWaveform[63] != waveform[63] {
		t.Fatalf("unexpected served waveform: %v", servedWaveform)
	}

	var rejected bytes.Buffer
	rejectedWriter := multipart.NewWriter(&rejected)
	rejectedPart, err := rejectedWriter.CreateFormFile("file", "nao-audio.txt")
	if err != nil {
		t.Fatalf("create rejected form file: %v", err)
	}
	if _, err := rejectedPart.Write([]byte("not audio")); err != nil {
		t.Fatalf("write rejected file: %v", err)
	}
	if err := rejectedWriter.Close(); err != nil {
		t.Fatalf("close rejected multipart: %v", err)
	}
	rejectedRequest := httptest.NewRequest(http.MethodPost, "/api/admin/uploads/audio", &rejected)
	rejectedRequest.Header.Set("Content-Type", rejectedWriter.FormDataContentType())
	rejectedRequest.AddCookie(cookies[0])
	rejectedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(rejectedRecorder, rejectedRequest)
	if rejectedRecorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected unsupported media status, got %d", rejectedRecorder.Code)
	}
}
