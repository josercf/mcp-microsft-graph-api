# 00 — Visão Geral & Arquitetura

> Status: 📝 Draft

## Objetivo

Construir um servidor **MCP** que exponha as capacidades da **Microsoft Graph API**
como tools utilizáveis por um assistente de IA, cobrindo gestão de **email,
calendário, to-do, contatos e arquivos do OneDrive**, com suporte a **múltiplas
contas Microsoft** (pessoais e corporativas) simultaneamente.

## Escopo do produto

### Dentro do escopo
- Autenticação multi-conta via **Device Code Flow**.
- Gestão de email: ler, buscar, enviar, responder, encaminhar, mover entre pastas,
  categorizar, sinalizar, gerenciar pastas.
- Gestão de calendário: listar, criar, atualizar, deletar eventos; aceitar/recusar
  convites; múltiplos calendários.
- Gestão de To-Do: CRUD de listas e de tarefas, subtarefas, mover tarefas entre listas.
- Gestão de contatos: CRUD básico e busca.
- Gestão de arquivos OneDrive: navegar, buscar, baixar, enviar, mover, compartilhar.

### Fora do escopo (v1)
- Microsoft Teams (chats, canais).
- SharePoint sites/drives de equipe (apenas OneDrive pessoal na v1).
- Webhooks / subscriptions (notificações em tempo real).
- OneNote, Planner, Excel API.

## Stack técnica

| Componente | Biblioteca | Versão alvo |
|---|---|---|
| Runtime | Node.js | ≥ 20 LTS |
| Linguagem | TypeScript | ≥ 5.x |
| MCP Server | `@modelcontextprotocol/sdk` | latest |
| Autenticação | `@azure/msal-node` | latest |
| Graph Client | `@microsoft/microsoft-graph-client` | latest |
| Validação de schema | `zod` | ≥ 3.x |
| Tipos Graph | `@microsoft/microsoft-graph-types` | latest |

## Arquitetura de alto nível

```
┌─────────────────────────────────────────────────┐
│                  Assistente IA                   │
└───────────────────────┬─────────────────────────┘
                        │ MCP (stdio)
┌───────────────────────▼─────────────────────────┐
│                  MCP Server                      │
│  ┌────────────────────────────────────────────┐ │
│  │ Tools layer (zod schemas + handlers)       │ │
│  │  auth · mail · calendar · todo · contacts  │ │
│  │  · files                                   │ │
│  └─────────────────┬──────────────────────────┘ │
│  ┌─────────────────▼──────────────────────────┐ │
│  │ Graph layer (operações por domínio)        │ │
│  └─────────────────┬──────────────────────────┘ │
│  ┌─────────────────▼──────────────────────────┐ │
│  │ Auth layer (MSAL · token cache multi-conta)│ │
│  └─────────────────┬──────────────────────────┘ │
└────────────────────┼─────────────────────────────┘
                     │ HTTPS
┌────────────────────▼─────────────────────────────┐
│            Microsoft Graph API (v1.0)            │
└──────────────────────────────────────────────────┘
```

## Estrutura de diretórios (planejada)

```
src/
├── index.ts                 # entrypoint do MCP server (registro de tools)
├── config.ts                # leitura de env vars (clientId, scopes, caminhos)
├── types.ts                 # tipos compartilhados
├── auth/
│   ├── msal.ts              # PublicClientApplication + device code flow
│   ├── tokenCache.ts        # persistência em disco do cache MSAL
│   └── accounts.ts          # registro/seleção de contas (default account)
├── graph/
│   ├── client.ts            # factory GraphServiceClient por accountId
│   ├── mail.ts
│   ├── calendar.ts
│   ├── todo.ts
│   ├── contacts.ts
│   └── files.ts
├── tools/
│   ├── auth-tools.ts
│   ├── mail-tools.ts
│   ├── calendar-tools.ts
│   ├── todo-tools.ts
│   ├── contact-tools.ts
│   └── file-tools.ts
└── utils/
    ├── errors.ts            # normalização de erros do Graph
    └── pagination.ts        # helpers de paginação
```

## Configuração (variáveis de ambiente)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GRAPH_CLIENT_ID` | Sim | Application (client) ID do app registrado no Azure AD. |
| `GRAPH_TENANT` | Não | `common` (default), `consumers`, `organizations` ou GUID. |
| `GRAPH_TOKEN_CACHE_PATH` | Não | Caminho do arquivo de cache de tokens. Default: `~/.mcp-graph/cache.json`. |
| `GRAPH_DEFAULT_ACCOUNT` | Não | `accountId` da conta usada quando nenhuma é especificada. |

> O app no Azure AD deve ser registrado como **"Public client"** (mobile & desktop)
> com a opção de fluxos públicos habilitada, e suportar contas em
> "Any organizational directory and personal Microsoft accounts" para permitir
> contas pessoais e corporativas.

## Scopes consolidados (todas as features)

```
User.Read
Mail.ReadWrite
Mail.Send
MailboxSettings.ReadWrite
Calendars.ReadWrite
Tasks.ReadWrite
Contacts.ReadWrite
Files.ReadWrite
offline_access
```

## Princípios de design

1. **Stateless por requisição** — cada tool resolve a conta, obtém token (do cache
   ou refresh) e executa. Não há estado de sessão entre chamadas além do cache de tokens.
2. **Multi-conta transparente** — o parâmetro `accountId` é uniforme em todas as tools.
3. **Saídas enxutas** — tools retornam apenas os campos relevantes (via `$select`),
   não o objeto Graph inteiro, para economizar contexto do modelo.
4. **Idempotência onde possível** — operações destrutivas pedem IDs explícitos.
5. **Erros legíveis** — toda falha do Graph vira mensagem acionável.

## Roadmap de implementação

| Fase | Entrega | Specs |
|---|---|---|
| 1 | Fundação + Auth multi-conta | 00, 01 |
| 2 | Email | 02 |
| 3 | Calendário | 03 |
| 4 | To-Do | 04 |
| 5 | Contatos | 05 |
| 6 | OneDrive | 06 |
