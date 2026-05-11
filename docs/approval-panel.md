# Tela de Aprovacao de Agendamentos

## Objetivo

Permitir que o gestor aprove, edite ou rejeite atendimentos sugeridos pelo agente
antes de qualquer criacao real de OS ou agenda no GCTech.

## Entrada

A tela le documentos da colecao `approval_tasks` com:

```text
type = new_whatsapp_appointment
status = pending
```

## Informacoes visiveis

- Nome do cliente
- Telefone
- Tipo/modelo do equipamento
- Problema relatado
- Tipo de atendimento: visita tecnica ou entrega do equipamento
- Endereco ou bairro/cidade
- Horario sugerido
- Mensagem sugerida para responder no WhatsApp
- Nivel de risco
- Data em que o agente criou o rascunho

## Acoes

### Aprovar

Cria a OS e o agendamento no GCTech, marca a tarefa como `approved` e libera a
resposta de confirmacao.

### Editar e aprovar

Permite ajustar dados antes de criar OS/agendamento:

- Nome
- Modelo
- Descricao do problema
- Endereco
- Horario
- Mensagem de retorno

Depois marca a tarefa como `edited`.

### Rejeitar

Marca a tarefa como `rejected` e exige um motivo curto. Nenhuma OS e nenhum
agendamento sao criados.

## Regras iniciais

- Orcamento nao aparece nesta tela.
- Garantia nao aparece nesta tela.
- Reclamacoes devem ser escaladas para atendimento manual.
- O botao de aprovar deve validar novamente se o horario continua livre.

## Proxima implementacao

Criar no GCTech:

```text
src/pages/Approvals.tsx
rota /approvals
item de menu "Aprovacoes" apenas para admin
```

