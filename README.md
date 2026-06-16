# MCP Microsoft Graph

Servidor **MCP** (Model Context Protocol) para interação com a **Microsoft Graph API**.
Gerencie email, calendário, to-do, contatos e arquivos OneDrive de uma ou mais contas
Microsoft (pessoais e corporativas) diretamente pelo seu assistente de IA.

## Features

| Módulo | Status | Tools |
|---|---|---|
| Autenticação multi-conta | ✅ Fase 1 | `add_account`, `confirm_account_auth`, `list_accounts`, `set_default_account`, `remove_account`, `whoami` |
| Email | 📋 Fase 2 | `list_emails`, `search_emails`, `get_email`, `send_email`, `reply_email`, `forward_email`, `move_email`, `set_email_categories`, `mark_email`, `list_mail_folders`, `create_mail_folder`, `list_categories`, `create_category` |
| Calendário | 📋 Fase 3 | `list_events`, `create_event`, `update_event`, `delete_event`, `respond_to_event`, `list_calendars`, `find_meeting_times` |
| To-Do | 📋 Fase 4 | `list_task_lists`, `create_task_list`, `rename_task_list`, `delete_task_list`, `list_tasks`, `create_task`, `update_task`, `complete_task`, `move_task`, `add_subtask`, ... |
| Contatos | 📋 Fase 5 | `list_contacts`, `search_contacts`, `create_contact`, `update_contact`, `delete_contact` |
| OneDrive | 📋 Fase 6 | `list_drive_items`, `search_drive`, `download_file`, `upload_file`, `create_folder`, `move_item`, `delete_item`, `create_share_link` |

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

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GRAPH_CLIENT_ID` | **Sim** | Client ID do app registrado. |
| `GRAPH_TENANT` | Não | `common` (default), `consumers`, `organizations` ou GUID do tenant. |
| `GRAPH_TOKEN_CACHE_PATH` | Não | Caminho do cache de tokens. Default: `~/.mcp-graph/token-cache.json`. |
| `GRAPH_DEFAULT_ACCOUNT` | Não | `accountId` da conta padrão. |

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
