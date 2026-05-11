# Fundacao WhatsApp -> Aprovacao -> Agenda

## Objetivo

Criar a primeira base operacional para atendimento via WhatsApp sem misturar a
automacao dentro do app principal.

O primeiro fluxo deve criar apenas rascunhos aprovaveis:

```text
Cliente envia mensagem
Agente coleta os dados minimos
Agente sugere horario disponivel
Sistema cria tarefa de aprovacao
Gestor aprova, edita ou rejeita
Somente depois o GCTech recebe OS e agendamento
```

## Campos minimos que o agente precisa coletar

- Nome do cliente
- Telefone/WhatsApp
- Tipo de equipamento
- Modelo do equipamento
- Problema relatado
- Cidade/bairro
- Endereco, quando for visita tecnica
- Preferencia: tecnico no local ou cliente traz o equipamento
- Dia ou periodo desejado

## Colecoes planejadas

### contacts

Contato vindo do WhatsApp, mesmo que ainda nao exista login no Firebase Auth.

### whatsapp_conversations

Sessao de conversa e estado atual do atendimento.

### approval_tasks

Fila de tarefas para aprovacao humana.

### agent_runs

Logs de execucao do agente para auditoria e melhoria.

## Fora da primeira fase

- Orcamento automatico
- Diagnostico final
- Compra de pecas
- Garantia
- Reclamos e negociacoes sensiveis
- Alteracao de preco

## Papel do Paperclip

Paperclip fica em segundo plano nesta fase. Ele pode virar painel central depois
que o motor de dados, aprovacao e sincronizacao estiver funcionando.

