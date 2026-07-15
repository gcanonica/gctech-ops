# GC Eletronica Ops - Deploy de Producao

## Servico

- Porta interna: `3100`
- Health check: `GET /health`
- Webhook: `POST /webhooks/whatsapp/inbound`
- Token obrigatorio fora de localhost: `OPS_WEBHOOK_TOKEN`

## Arquivos esperados

```txt
gc-eletronica-ops/
  .env.production
  secrets/firebase-service-account.json
../GCTech/
  firebase-applet-config.json
```

Baseie o ambiente em `.env.production.example`.

## Subir com Docker

```bash
docker compose up -d --build
docker compose logs -f gctech-ops
```

## Reverse proxy sugerido

```txt
ops.gceletronica.com.br -> http://127.0.0.1:3100
```

Use HTTPS obrigatorio em producao.

## Checklist

- `npm run typecheck`
- `npm run test`
- `npm audit --audit-level=moderate`
- `OPS_WEBHOOK_TOKEN` longo e aleatorio
- n8n/Evolution API enviando `Authorization: Bearer <token>`
- Logs acompanhados no primeiro dia de uso real
