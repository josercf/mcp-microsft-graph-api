# Setup do App no Azure AD (Microsoft Entra)

Passo a passo para criar o `GRAPH_CLIENT_ID` e conceder os scopes que o servidor usa.

> Não precisa de assinatura paga do Azure. Contas pessoais (outlook/hotmail/live)
> também conseguem registrar apps.

## 1. Acessar o registro de apps

1. Entre no [Azure Portal](https://portal.azure.com).
2. Busque por **Microsoft Entra ID** (antigo Azure Active Directory).
3. **App registrations** → **+ New registration**.

## 2. Registrar o app

| Campo | Valor |
|---|---|
| **Name** | qualquer (ex.: `mcp-graph-local`) |
| **Supported account types** | **Accounts in any organizational directory and personal Microsoft accounts** (suporta conta pessoal **e** corporativa) |
| **Redirect URI** | deixar **em branco** (Device Code Flow não usa) |

Clique em **Register**.

## 3. Copiar o GRAPH_CLIENT_ID

Na tela **Overview**, copie o **Application (client) ID**. Esse é o seu `GRAPH_CLIENT_ID`.

## 4. Habilitar o Device Code Flow

1. **Authentication** → **Advanced settings** → **Allow public client flows** → **Yes** → **Save**.

Sem isso, o `add_account` falha — o Device Code Flow exige cliente público.

## 5. Adicionar os scopes (API permissions)

1. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Adicione exatamente estes:

| Scope | Para que serve |
|---|---|
| `User.Read` | perfil do usuário / `whoami` |
| `Mail.ReadWrite` | ler, mover, categorizar e excluir emails |
| `Mail.Send` | enviar e responder emails |
| `MailboxSettings.ReadWrite` | categorias (tags do Outlook) |
| `Calendars.ReadWrite` | eventos, convites, `find_meeting_times` |
| `Tasks.ReadWrite` | listas e tarefas (To-Do) |
| `Contacts.ReadWrite` | contatos |
| `Files.ReadWrite` | OneDrive (navegar, upload, download, compartilhar) |
| `offline_access` | refresh token (renovação automática) |

3. **Add permissions**.

> São **Delegated permissions** (o app age em nome do usuário logado), **não**
> Application permissions.

## 6. Consentimento

- **Conta pessoal** ou **corporativa onde você é admin**: o consentimento é dado na
  primeira vez que você roda `add_account` e autentica no browser.
- **Conta corporativa sem ser admin**: pode ser necessário **Grant admin consent for
  [org]** na tela de API permissions, ou pedir ao admin do tenant.

## 7. Variáveis de ambiente relacionadas

| Variável | Default | Observação |
|---|---|---|
| `GRAPH_CLIENT_ID` | — | **obrigatória**, do passo 3 |
| `GRAPH_TENANT` | `common` | `consumers` (só pessoais), `organizations` (só corporativas) ou GUID do tenant |

## Reduzir os scopes

Os scopes pedidos no `add_account` são fixos em [`src/config.ts`](../src/config.ts)
(`config.scopes`). Se você só usa email, pode editar esse array para
`User.Read`, `Mail.ReadWrite`, `Mail.Send`, `offline_access` — e adicionar apenas
esses no passo 5.
