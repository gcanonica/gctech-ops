# GC Eletronica Ops - Deploy de Producao

## Servico

- Porta interna: `3100`
- Liveness (processo vivo): `GET /health`
- Readiness (Firestore acessivel): `GET /ready`
- Webhook: `POST /webhooks/whatsapp/inbound`
- Token obrigatorio fora de localhost: `OPS_WEBHOOK_TOKEN`
- Token exclusivo da outbox: `OPS_OUTBOX_TOKEN`
- Idempotencia persistente em `webhook_events` (retencao logica de 7 dias)

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

O container roda como usuario sem privilegios, com filesystem somente leitura e
a porta publicada apenas em `127.0.0.1`. O proxy reverso deve ser o unico ponto
publico. Configure `TRUST_PROXY=true` somente quando esse proxy for confiavel.

## Contrato de entrega do webhook

Envie `X-Event-Id` ou `X-Idempotency-Key` com o identificador imutavel da mensagem
da Evolution API. Na ausencia dele, o servico usa o hash do payload completo.
Uma repeticao concluida devolve a resposta original e o header
`X-Idempotent-Replay: true`; uma entrega concorrente recebe `409` e pode tentar
novamente. Falhas internas liberam a chave para retry.

Configure no Firestore uma politica de TTL para o campo `expiresAt` da colecao
`webhook_events`, evitando crescimento indefinido.

## Outbox de mensagens para o n8n

Toda resposta WhatsApp processada com sucesso cria, de forma idempotente, um
documento em `message_outbox`. O servico nao chama a Evolution API. O n8n usa
`Authorization: Bearer <OPS_OUTBOX_TOKEN>` nos endpoints:

```txt
POST /outbox/messages/claim
POST /outbox/messages/:id/sent
POST /outbox/messages/:id/failed
```

Exemplo de claim:

```json
{ "workerId": "n8n-producao-01", "limit": 10 }
```

Cada mensagem recebe lease de dois minutos e incrementa `attempts`. Depois de
enviar à Evolution, confirme com `{ "workerId": "n8n-producao-01",
"providerMessageId": "..." }`. Em falha terminal, envie `{ "workerId":
"n8n-producao-01", "errorCode": "...", "errorMessage": "..." }`. Apenas o
worker dono do lease pode concluir a mensagem. Os estados auditáveis são
`pending`, `sent` e `failed`.

## Reverse proxy sugerido

```txt
ops.gceletronica.com.br -> http://127.0.0.1:3100
```

Use HTTPS obrigatorio em producao.

## Checklist

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=moderate`
- `OPS_WEBHOOK_TOKEN` longo e aleatorio
- n8n/Evolution API enviando `Authorization: Bearer <token>`
- Logs acompanhados no primeiro dia de uso real

## Smoke test e rollback

Depois do deploy, confirme `GET /health`, `GET /ready` e envie o mesmo evento de
teste duas vezes; a segunda resposta deve conter `X-Idempotent-Replay: true`.
Para rollback, mantenha a imagem anterior tagueada, volte a tag no Compose e rode
`docker compose up -d`. A colecao de idempotencia e retrocompativel e nao exige
migracao destrutiva.
