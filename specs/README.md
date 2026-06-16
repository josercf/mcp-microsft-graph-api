# Especificações — MCP Microsoft Graph API

Este diretório contém as especificações funcionais do MCP (Model Context Protocol)
para integração com a **Microsoft Graph API**, seguindo a metodologia
**Spec Driven Development**: primeiro especificamos o comportamento de cada feature,
depois implementamos.

## Como ler estas specs

Cada documento descreve **o que** o sistema faz (comportamento observável), não
**como** ele é implementado. A implementação só começa após as specs estarem
acordadas. Cada spec de módulo segue o mesmo formato:

- **Objetivo** — o problema que o módulo resolve.
- **User Stories** — necessidades do usuário, formato `Como… quero… para…`.
- **Tools MCP** — nome, parâmetros de entrada, saída e comportamento de cada tool.
- **Endpoints Graph** — quais rotas do Graph cada tool consome.
- **Edge cases & erros** — comportamentos esperados em falhas.
- **Scopes** — permissões OAuth exigidas.

## Índice

| # | Spec | Status |
|---|------|--------|
| 00 | [Visão Geral & Arquitetura](./00-visao-geral.md) | 📝 Draft |
| 01 | [Autenticação & Multi-conta](./01-autenticacao.md) | 📝 Draft |
| 02 | [Email](./02-email.md) | 📝 Draft |
| 03 | [Calendário](./03-calendario.md) | 📝 Draft |
| 04 | [To-Do](./04-todo.md) | 📝 Draft |
| 05 | [Contatos](./05-contatos.md) | 📝 Draft |
| 06 | [OneDrive (Arquivos)](./06-onedrive.md) | 📝 Draft |

## Convenções globais

### Identificação de conta (`accountId`)
**Toda** tool que acessa dados de uma conta aceita um parâmetro opcional
`accountId`. Quando omitido, usa a **conta padrão** (default account). Isso
permite operar múltiplas contas Microsoft (pessoais e corporativas) no mesmo
servidor MCP. Ver [01-autenticacao.md](./01-autenticacao.md).

### Formato de datas
Todas as datas/horas seguem **ISO 8601** (`2026-06-16T14:30:00`) acompanhadas
de um `timeZone` IANA (ex.: `America/Sao_Paulo`) quando aplicável.

### Paginação
Tools de listagem aceitam `top` (limite por página, default 25) e retornam um
cursor `nextLink` (opaco) quando há mais resultados. Passar o cursor de volta em
`skipToken` continua a paginação.

### Tratamento de erros
Erros do Graph são normalizados para um formato consistente:
```json
{ "error": { "code": "ErrorCode", "message": "descrição legível", "retryable": false } }
```

### Status das specs
- 📝 **Draft** — em escrita/revisão.
- ✅ **Approved** — pronta para implementação.
- 🚧 **In Progress** — sendo implementada.
- ✔️ **Done** — implementada e testada.
