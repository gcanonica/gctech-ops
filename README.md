# GC Eletronica Ops

Camada externa de automacao e agentes para o app GCTech.

O GCTech continua sendo o sistema oficial de OS, agenda, clientes e financeiro.
Este projeto fica ao redor dele para receber mensagens do WhatsApp, montar
rascunhos, gerar tarefas de aprovacao e sincronizar somente depois da aprovacao.

## Fundacao

Fluxo inicial:

```text
WhatsApp
  -> automacao
  -> agente de atendimento
  -> rascunho de OS e agenda
  -> aprovacao humana
  -> Firebase/GCTech
```

## Regra de seguranca

O agente pode coletar dados, sugerir horarios e preparar rascunhos.
Ele nao deve enviar orcamento, prometer prazo tecnico, responder reclamacao ou
confirmar alteracoes financeiras sem aprovacao.

## Desenvolvimento

Use `.env.example` como base. O servidor valida ambiente e credenciais no startup.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

As instrucoes operacionais estao em `docs/production-deploy.md`.
