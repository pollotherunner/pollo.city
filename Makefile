.PHONY: install dev check test vet build docker-up docker-down

install:
	npm ci

dev:
	@trap 'kill 0' INT TERM EXIT; \
	npm run dev & \
	go run ./backend/cmd/server

check:
	npm run check

test:
	npm test
	go test ./backend/...

vet:
	go vet ./backend/...

build:
	npm run build
	go build -o bin/pollo ./backend/cmd/server

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
