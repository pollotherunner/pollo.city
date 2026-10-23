.PHONY: dev test vet build docker-up docker-down

dev:
	go run ./backend/cmd/server

test:
	go test ./backend/...

vet:
	go vet ./backend/...

build:
	go build -o bin/pollo ./backend/cmd/server

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
