# 02 — Email

> Status: 📝 Draft

## Objetivo

Gerenciar email das contas conectadas: ler, buscar, compor e enviar, responder,
encaminhar, organizar em pastas, categorizar (tags/categorias), sinalizar e
gerenciar pastas — refletindo o modelo de organização do Outlook.

## Modelo de organização do Outlook (importante)

Diferente do Gmail, o Outlook organiza email por:
- **Pasta** — um email vive em **exatamente uma** pasta por vez (`inbox`, `archive`,
  pastas customizadas...). "Mover" troca a pasta.
- **Categorias** — múltiplas **tags coloridas** aplicáveis ao mesmo email
  (equivalente funcional a "labels" do Gmail). Gerenciadas por uma paleta master.
- **Flags** e **importância** — sinalizações adicionais.

A combinação pasta + categorias cobre os casos de uso de classificação/labels.

## User Stories

- Como usuário, quero **listar e buscar** emails (por remetente, assunto, texto,
  não lidos), para encontrar o que preciso.
- Como usuário, quero **ler** o conteúdo completo de um email e seus anexos.
- Como usuário, quero **enviar** um email novo, com cc/cco e anexos.
- Como usuário, quero **responder** (ou responder a todos) e **encaminhar**.
- Como usuário, quero **mover** emails entre pastas e **arquivar**.
- Como usuário, quero **categorizar** emails com tags coloridas.
- Como usuário, quero **marcar como lido/não lido** e **sinalizar**.
- Como usuário, quero **criar e listar pastas**.

## Tools MCP

> Todas aceitam `accountId` opcional (default account).

### Leitura e busca

#### `list_emails`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `folderId` | string | Não | Pasta (id ou nome de sistema: `inbox`, `archive`...). Default: `inbox`. |
| `unreadOnly` | boolean | Não | Apenas não lidos. Default: false. |
| `top` | number | Não | Limite. Default: 25. |
| `skipToken` | string | Não | Cursor de paginação. |
| `accountId` | string | Não | |

**Output:** lista de resumos `{ id, subject, from, receivedDateTime, isRead, hasAttachments, bodyPreview, categories[] }` + `nextLink`.
**Endpoint:** `GET /me/mailFolders/{folderId}/messages?$select=...&$top=...&$orderby=receivedDateTime desc`

#### `search_emails`
Busca full-text.
**Input:** `query` (string, obrig.), `top`, `skipToken`, `accountId`.
**Output:** mesma estrutura de `list_emails`.
**Endpoint:** `GET /me/messages?$search="{query}"` (KQL: `from:`, `subject:`, etc.).

#### `get_email`
Lê um email completo.
**Input:** `messageId` (obrig.), `bodyFormat` (`text`|`html`, default `text`), `accountId`.
**Output:** `{ id, subject, from, toRecipients[], ccRecipients[], receivedDateTime, body, categories[], isRead, importance, hasAttachments, attachments[] (id, name, contentType, size) }`.
**Endpoint:** `GET /me/messages/{id}` (+ `GET /me/messages/{id}/attachments` se solicitado).

#### `download_attachment`
**Input:** `messageId`, `attachmentId`, `accountId`.
**Output:** `{ name, contentType, contentBytes (base64) }` ou caminho salvo (decisão de implementação).
**Endpoint:** `GET /me/messages/{id}/attachments/{attId}`.

### Composição e envio

#### `send_email`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `to` | string[] | Sim | Destinatários. |
| `subject` | string | Sim | |
| `body` | string | Sim | Corpo. |
| `bodyType` | `text`\|`html` | Não | Default `text`. |
| `cc` | string[] | Não | |
| `bcc` | string[] | Não | |
| `attachments` | array | Não | `{ name, contentType, contentBase64 }`. |
| `saveToSentItems` | boolean | Não | Default true. |
| `accountId` | string | Não | |

**Output:** `{ sent: true }`.
**Endpoint:** `POST /me/sendMail`.

#### `create_draft`
Cria rascunho (não envia).
**Input:** mesmos campos de `send_email`.
**Output:** `{ id, ...resumo }`.
**Endpoint:** `POST /me/messages`.

#### `reply_email`
**Input:** `messageId` (obrig.), `body` (obrig.), `replyAll` (bool, default false), `accountId`.
**Output:** `{ sent: true }`.
**Endpoint:** `POST /me/messages/{id}/reply` ou `/replyAll`.

#### `forward_email`
**Input:** `messageId`, `to` (string[], obrig.), `comment` (string, opcional), `accountId`.
**Output:** `{ sent: true }`.
**Endpoint:** `POST /me/messages/{id}/forward`.

### Organização

#### `move_email`
**Input:** `messageId`, `destinationFolderId` (id ou nome de sistema), `accountId`.
**Output:** `{ id, parentFolderId }` (o move retorna novo recurso).
**Endpoint:** `POST /me/messages/{id}/move` body `{ destinationId }`.

#### `archive_email`
Atalho para mover à pasta `archive`.
**Input:** `messageId`, `accountId`.
**Endpoint:** `POST /me/messages/{id}/move` com `destinationId: "archive"`.

#### `delete_email`
**Input:** `messageId`, `permanent` (bool, default false → vai para Itens Excluídos), `accountId`.
**Endpoint:** `DELETE /me/messages/{id}` (permanent) ou `move` para `deleteditems`.

#### `set_email_categories`
Aplica/substitui categorias (tags) de um email.
**Input:** `messageId`, `categories` (string[]), `accountId`.
**Output:** `{ id, categories[] }`.
**Endpoint:** `PATCH /me/messages/{id}` body `{ categories: [...] }`.

#### `mark_email`
Marca lido/não lido, sinaliza, define importância.
**Input:** `messageId`, `isRead` (bool, opcional), `flag` (`flagged`|`complete`|`notFlagged`, opcional), `importance` (`low`|`normal`|`high`, opcional), `accountId`.
**Output:** `{ id, isRead, flag, importance }`.
**Endpoint:** `PATCH /me/messages/{id}`.

### Pastas

#### `list_mail_folders`
**Input:** `parentFolderId` (opcional, para subpastas), `accountId`.
**Output:** `[{ id, displayName, unreadItemCount, totalItemCount, childFolderCount }]`.
**Endpoint:** `GET /me/mailFolders` (ou `/me/mailFolders/{id}/childFolders`).

#### `create_mail_folder`
**Input:** `displayName` (obrig.), `parentFolderId` (opcional), `accountId`.
**Output:** `{ id, displayName }`.
**Endpoint:** `POST /me/mailFolders` (ou `/childFolders`).

### Categorias master (paleta)

#### `list_categories`
Lista as categorias disponíveis na conta com suas cores.
**Input:** `accountId`.
**Output:** `[{ id, displayName, color }]`.
**Endpoint:** `GET /me/outlook/masterCategories`.

#### `create_category`
Cria uma nova categoria na paleta.
**Input:** `displayName` (obrig.), `color` (preset `preset0`..`preset24`), `accountId`.
**Output:** `{ id, displayName, color }`.
**Endpoint:** `POST /me/outlook/masterCategories`.

## Endpoints Graph (resumo)

| Tool | Método | Rota |
|---|---|---|
| list_emails | GET | `/me/mailFolders/{f}/messages` |
| search_emails | GET | `/me/messages?$search` |
| get_email | GET | `/me/messages/{id}` |
| download_attachment | GET | `/me/messages/{id}/attachments/{a}` |
| send_email | POST | `/me/sendMail` |
| create_draft | POST | `/me/messages` |
| reply_email | POST | `/me/messages/{id}/reply(All)` |
| forward_email | POST | `/me/messages/{id}/forward` |
| move_email/archive | POST | `/me/messages/{id}/move` |
| delete_email | DELETE | `/me/messages/{id}` |
| set_email_categories/mark_email | PATCH | `/me/messages/{id}` |
| list/create folder | GET/POST | `/me/mailFolders` |
| list/create category | GET/POST | `/me/outlook/masterCategories` |

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| `messageId` inexistente | Erro `NOT_FOUND`. |
| Pasta de sistema por nome inválido | Erro `INVALID_FOLDER`. |
| `$search` + `$orderby` juntos | Não suportado pelo Graph → ignorar orderby quando há search; documentar. |
| Anexo > 3 MB no envio | Requer upload session; v1 limita anexos a 3 MB inline e retorna erro `ATTACHMENT_TOO_LARGE` acima disso. |
| Categoria aplicada não existe na paleta | Graph aceita; tool opcionalmente cria na paleta (decisão de implementação). |
| Mover para `deleteditems` vs delete permanente | `delete_email` distingue via flag `permanent`. |

## Scopes
```
Mail.ReadWrite
Mail.Send
MailboxSettings.ReadWrite   # masterCategories
```
