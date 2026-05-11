# Webhook WhatsApp Inbound

Endpoint local para receber mensagens vindas do WhatsApp/n8n/Evolution API.

O endpoint agora trabalha como conversa guiada:

- recebe uma mensagem parcial;
- salva os campos ja coletados no Firestore;
- responde pedindo apenas o proximo dado faltante;
- para visita tecnica, exige rua, numero e bairro; se houver indicio de apartamento/condominio, exige complemento;
- cria uma tarefa em `approval_tasks` somente quando os dados minimos estiverem completos.

## Rodar o servidor

```bash
npm run dev
```

Por padrao ele abre em:

```text
http://localhost:3100
```

## Health check

```text
GET /health
```

## Receber mensagem do WhatsApp

```text
POST /webhooks/whatsapp/inbound
```

Quando o webhook estiver fora do localhost, envie um token igual ao valor de `OPS_WEBHOOK_TOKEN`:

```text
Authorization: Bearer seu-token
```

Tambem e aceito:

```text
x-webhook-token: seu-token
```

Payload direto para testes:

```json
{
  "phone": "41999990000",
  "name": "Cliente Teste WhatsApp",
  "message": "Tenho um iPhone 11 com tela quebrada. Moro na Rua Teste, 123, Centro, Rio Branco do Sul e queria visita amanha as 10h.",
  "timestamp": "2026-05-07T14:00:00.000Z"
}
```

Tambem aceita o formato comum da Evolution API:

```json
{
  "event": "messages.upsert",
  "data": {
    "pushName": "Cliente Teste",
    "key": {
      "remoteJid": "5541999990000@s.whatsapp.net"
    },
    "message": {
      "conversation": "Tenho um iPhone 11 com tela quebrada"
    },
    "messageTimestamp": 1778152800
  }
}
```

## Quando faltam dados

Resposta esperada:

```json
{
  "ok": true,
  "status": "collecting_data",
  "missingFields": ["city", "address", "preferredTime"],
  "contactId": "...",
  "conversationId": "...",
  "reply": "Perfeito, Cliente. Qual e sua cidade? Atendemos Rio Branco do Sul e Itaperucu."
}
```

O n8n pode usar `reply` como rascunho para enviar ao cliente ou para mostrar a voce antes do envio.

## Quando a coleta esta completa

Resposta esperada:

```json
{
  "ok": true,
  "status": "approval_created",
  "approvalTaskId": "...",
  "contactId": "...",
  "conversationId": "...",
  "reply": "Perfeito, Cliente. Separei seu atendimento para confirmacao interna e ja te retorno por aqui."
}
```

Depois disso, a aba Aprovações do GCTech mostra a tarefa para voce aprovar.

## Teste automatico

Com o servidor rodando:

```bash
npm run test:inbound
```

Depois abra a aba Aprovações no GCTech.
