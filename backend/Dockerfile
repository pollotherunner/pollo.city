FROM node:24-alpine AS frontend

WORKDIR /src
COPY package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts ./
RUN npm ci
COPY frontend ./frontend
RUN npm run build

FROM golang:1.27-alpine AS backend

WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/pollo ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app

WORKDIR /app
COPY --from=backend /out/pollo /app/pollo
COPY --from=frontend /src/dist /app/public
RUN mkdir -p /data/uploads && chown -R app:app /data

USER app
ENV TZ=America/Sao_Paulo
ENV HTTP_ADDR=:8080
ENV PUBLIC_DIR=/app/public
ENV DATABASE_PATH=/data/pollo.db
ENV UPLOADS_DIR=/data/uploads

EXPOSE 8080
ENTRYPOINT ["/app/pollo"]
