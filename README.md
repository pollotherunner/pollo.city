# pollo.city

Blog pessoal com backend em Go, SQLite e frontend Vite/TypeScript.

## Requisitos

- Node.js >= 22.12
- Go >= 1.27
- Docker e Docker Compose para produção

## Desenvolvimento local

```sh
npm ci
cp .env.example .env
```

Para rodar localmente em HTTP, ajuste o `.env`:

```env
DOMAIN=:80
COOKIE_SECURE=false
ADMIN_PASSWORD=uma-senha-local-com-pelo-menos-8-caracteres
```

Depois:

```sh
make dev
```

- Site: http://localhost:5173
- Admin: http://localhost:5173/admin
- API direta: http://localhost:8080

O Vite faz proxy de `/api` e `/uploads` para o backend.

## Testes

```sh
make check   # TypeScript
make test    # Vitest + Go
make vet     # go vet
make build   # frontend + binário Go
```

## Produção

1. Crie o `.env` com um domínio real e uma senha forte:

```env
DOMAIN=blog.exemplo.com
ADMIN_PASSWORD=uma-senha-longa-e-unica
COOKIE_SECURE=true
SESSION_TTL=24h
```

2. Suba os containers:

```sh
make docker-up
```

O Caddy obtém o certificado TLS automaticamente e faz proxy para o app. O banco e os uploads ficam no volume `app_data`.

Para atualizar a imagem:

```sh
make deploy
```

Prefira fixar `APP_IMAGE` em uma tag `sha-*` específica em vez de `latest` para deploys reproduzíveis.

## Uploads e limpeza automática

- Imagens: até `MAX_UPLOAD_MB`.
- Áudio: até `MAX_AUDIO_UPLOAD_MB`.
- Arquivos ficam em `/data/uploads` dentro do volume.
- A limpeza de órfãos roda no boot e a cada 6 horas.
- Só apaga arquivos sem referência em posts, rascunhos ou Sobre, com idade maior que `ORPHAN_UPLOAD_AGE` (mínimo `1h`, padrão `24h`).
- Se o banco estiver vazio, a limpeza não apaga nada, para evitar perda em caso de configuração errada.

## Backup e restauração

No painel, **Exportar dados** baixa um `.zip` com:

- `backup.json` (posts, comentários, rascunhos e Sobre);
- `uploads/` (imagens, áudios e waveforms).

**Importar dados** aceita esse `.zip` e substitui o conteúdo atual. Backups JSON antigos ainda podem ser importados, mas não contêm as mídias.

Faça backup periódico do volume `app_data` ou do ZIP exportado. O backup JSON sozinho não é suficiente para restaurar imagens e áudios.

## Segurança

- Login único por senha (`ADMIN_PASSWORD`).
- Sessão opaca com token armazenado como hash no SQLite.
- Cookie `HttpOnly`, `SameSite=Strict` e `Secure` quando `COOKIE_SECURE=true`.
- Login e comentários têm rate limit por IP.
- Sessões emitidas com uma senha antiga deixam de valer após a troca de `ADMIN_PASSWORD`.
- Em produção, mantenha `COOKIE_SECURE=true` e use HTTPS.
