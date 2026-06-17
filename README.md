# MCP Microsoft Graph

Servidor **MCP** (Model Context Protocol) para interação com a **Microsoft Graph API**.
Gerencie email, calendário, to-do, contatos e arquivos OneDrive de uma ou mais contas
Microsoft (pessoais e corporativas) diretamente pelo seu assistente de IA.

## Features

**66 tools** cobrindo 6 módulos. Referência completa de cada tool e seus parâmetros em [`docs/TOOLS.md`](./docs/TOOLS.md).

| Módulo | Tools | Destaques |
|---|---|---|
| Autenticação multi-conta | 6 | Device Code Flow em 2 etapas, multi-conta (pessoal + corporativa), conta padrão configurável |
| Email | 20 | Listagem, busca KQL, envio, rascunho, resposta, encaminhamento, mover/arquivar, categorias (tags Outlook), flags, pastas, regras de caixa de entrada |
| Calendário | 8 | `calendarView` (expande recorrências), criar com convidados + Teams, aceitar/recusar, `find_meeting_times` |
| To-Do | 15 | CRUD de listas e tarefas, subtarefas (checklistItems), `move_task` |
| Contatos | 6 | CRUD + busca full-text via `$search` com paginação |
| OneDrive | 11 | Navegar, buscar, download via pre-authed URL, upload simples + chunked, compartilhar |

## Pré-requisitos

1. **Node.js ≥ 20**
2. **App registrado no Azure AD** — ver seção abaixo.

## Registro do App no Azure AD

1. Acesse o [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Nome: qualquer (ex.: `mcp-graph-local`).
3. Supported account types: **"Accounts in any organizational directory and personal Microsoft accounts"**.
4. Redirect URI: deixar em branco (não é necessário para Device Code Flow).
5. Após criar, copie o **Application (client) ID**.
6. Vá em **Authentication** → habilite **"Allow public client flows"** (Device Code Flow requer isso).
7. Vá em **API permissions** → **Add permission** → **Microsoft Graph** → **Delegated permissions** e adicione:
   - `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.ReadWrite`
   - `Calendars.ReadWrite`, `Tasks.ReadWrite`, `Contacts.ReadWrite`, `Files.ReadWrite`
   - `offline_access`

> 📖 Passo a passo detalhado, com tabela de scopes e notas de consentimento, em
> [`docs/SETUP-AZURE.md`](./docs/SETUP-AZURE.md).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GRAPH_CLIENT_ID` | **Sim** | Client ID do app registrado. |
| `GRAPH_TENANT` | Não | `common` (default), `consumers`, `organizations` ou GUID do tenant. |
| `GRAPH_TOKEN_CACHE_PATH` | Não | Caminho do cache de tokens. Default: `~/.mcp-graph/token-cache.json`. |
| `GRAPH_DEFAULT_ACCOUNT` | Não | `accountId` da conta padrão. |
| `GRAPH_DEBUG` | Não | `1`/`true` liga logs de depuração (requisições e erros do Graph) em **stderr**. |
| `GRAPH_LOG_FILE` | Não | Se definido, além do stderr os logs são anexados a este arquivo. |

## Depuração (logs)

O servidor nunca escreve logs em **stdout** (reservado ao protocolo MCP). Com
`GRAPH_DEBUG=1`, ele registra em **stderr** cada requisição ao Graph e o detalhe
completo dos erros (código, `statusCode`, `requestId` e o `body` da resposta) —
útil para diagnosticar respostas `400 Invalid request`.

```jsonc
// claude_desktop_config.json
"env": {
  "GRAPH_CLIENT_ID": "seu-client-id",
  "GRAPH_DEBUG": "1",
  "GRAPH_LOG_FILE": "/tmp/mcp-graph.log"   // opcional: persiste os logs em arquivo
}
```

O Claude Desktop expõe o stderr do servidor nos logs MCP
(`~/Library/Logs/Claude/mcp-server-microsoft-graph.log` no macOS). Com
`GRAPH_LOG_FILE`, basta `tail -f /tmp/mcp-graph.log` para acompanhar.

## Instalação e uso

```bash
# Clone e instale
git clone <repo>
cd mcp-microsoft-graph
npm install
npm run build

# Configure
export GRAPH_CLIENT_ID="seu-client-id-aqui"

# Execute
npm start
```

### Scripts disponíveis

| Script | O que faz |
|---|---|
| `npm run build` | Compila TypeScript → `dist/` |
| `npm start` | Roda o servidor compilado (`dist/index.js`) via stdio |
| `npm run dev` | Roda direto do fonte com `tsx` (sem build) |
| `npm run typecheck` | Type-check sem emitir arquivos |

## Verificação rápida (smoke test)

Você pode confirmar que o servidor inicializa e registra todas as tools **sem
precisar de credenciais Microsoft** — a autenticação é preguiçosa (lazy) e só é
acionada quando uma tool é de fato chamada. Faça o handshake MCP via stdio e liste
as tools:

```bash
npm run build

printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | GRAPH_CLIENT_ID="dummy" node dist/index.js
```

A segunda resposta JSON-RPC (`"id":2`) deve listar as **66 tools**. Um teste
funcional de verdade (com chamadas reais ao Graph) exige um `GRAPH_CLIENT_ID`
válido e autenticação interativa via `add_account` → `confirm_account_auth`.

## Configuração no Claude Desktop (ou outro cliente MCP)

No arquivo de configuração do cliente MCP (ex.: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "microsoft-graph": {
      "command": "node",
      "args": ["/caminho/para/mcp-microsoft-graph/dist/index.js"],
      "env": {
        "GRAPH_CLIENT_ID": "seu-client-id-aqui"
      }
    }
  }
}
```

## Fluxo de autenticação

```
1. Chame add_account
   → Retorna: URL + código curto (ex: ABCD-1234)

2. Abra https://microsoft.com/devicelogin e insira o código

3. Autentique com sua conta Microsoft

4. Chame confirm_account_auth com o userCode
   → Retorna: conta conectada com accountId

5. Todas as outras tools usam essa conta automaticamente
   (ou passe accountId para usar uma conta específica)
```

## Segurança

- O cache de tokens (`~/.mcp-graph/token-cache.json`) contém **refresh tokens** sensíveis.
  O arquivo é criado com permissão `600` (somente o dono lê/escreve).
- `remove_account` remove os tokens locais mas **não revoga** o consentimento no Azure.
  Para revogação completa, acesse [myapps.microsoft.com](https://myapps.microsoft.com).

## Specs

As especificações funcionais de cada módulo estão em [`specs/`](./specs/).
