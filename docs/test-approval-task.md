# Gerar Approval Task De Teste

Este teste alimenta a fila de Aprovações do GCTech sem WhatsApp real.

## Configuracao

Crie `.env` a partir de `.env.example` e configure:

```env
GCTECH_FIREBASE_CONFIG_PATH=C:\Users\GC\Documents\Codex\2026-04-28\buscar-projeto-no-github\GCTech\firebase-applet-config.json
GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\para\firebase-admin.json
```

Tambem e possivel usar `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Rodar

```bash
npm run create:test-approval
```

Depois abra:

```text
http://localhost:3000/approvals
```

Voce deve ver um rascunho pendente para aprovar, editar ou rejeitar.

## Campos opcionais

```env
TEST_CUSTOMER_NAME=Cliente Teste WhatsApp
TEST_CUSTOMER_PHONE=41999990000
TEST_DEVICE_NAME=iPhone 11
TEST_PROBLEM_DESCRIPTION=Tela quebrada e toque falhando.
TEST_NEIGHBORHOOD=Centro
TEST_ADDRESS=Rua Teste, 123, Centro, Rio Branco do Sul - PR
TEST_APPOINTMENT_START=2026-05-08T10:00:00-03:00
```

