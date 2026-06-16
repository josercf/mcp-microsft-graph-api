# 06 — OneDrive (Arquivos)

> Status: 📝 Draft

## Objetivo

Dar acesso aos arquivos do **OneDrive** das contas: navegar pastas, buscar, baixar
e enviar conteúdo, criar pastas, mover/renomear/excluir itens e gerar links de
compartilhamento.

## Conceitos

- **Drive** — armazenamento do usuário (`/me/drive`). v1 foca no OneDrive pessoal
  do usuário (drive padrão).
- **DriveItem** — arquivo ou pasta. Identificável por `id` ou por **caminho**
  (`/me/drive/root:/Documentos/relatorio.docx:`). Tem `name`, `size`,
  `folder`/`file` facets, `lastModifiedDateTime`, `webUrl`, `parentReference`.
- **Endereçamento por caminho vs id** — as tools aceitam `itemId` **ou** `path`.
  Pelo menos um é necessário em operações sobre item existente.

## User Stories

- Como usuário, quero **navegar** pelas pastas do meu OneDrive.
- Como usuário, quero **buscar** arquivos por nome/conteúdo.
- Como usuário, quero **baixar** o conteúdo de um arquivo.
- Como usuário, quero **enviar** (upload) um arquivo, inclusive grandes.
- Como usuário, quero **criar pastas**.
- Como usuário, quero **mover, renomear e excluir** itens.
- Como usuário, quero **gerar um link de compartilhamento** de um arquivo.
- Como usuário, quero ver **arquivos recentes** e **compartilhados comigo**.

## Tools MCP

> Todas aceitam `accountId` opcional (default account).

### Navegação e busca

#### `list_drive_items`
Lista itens de uma pasta.
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `folderId` | string | Não | Id da pasta. |
| `path` | string | Não | Caminho da pasta (ex.: `/Documentos`). Default: raiz. |
| `top` | number | Não | Default 50. |
| `skipToken` | string | Não | |
| `accountId` | string | Não | |

**Output:** `[{ id, name, type: file|folder, size, lastModifiedDateTime, webUrl, childCount? }]` + `nextLink`.
**Endpoint:** `GET /me/drive/root/children` ou `/me/drive/root:/{path}:/children` ou `/me/drive/items/{folderId}/children`.

#### `search_drive`
Busca arquivos/pastas.
**Input:** `query` (obrig.), `top`, `accountId`.
**Output:** mesma estrutura de `list_drive_items`.
**Endpoint:** `GET /me/drive/root/search(q='{query}')`.

#### `get_drive_item`
Metadados de um item.
**Input:** `itemId` **ou** `path`, `accountId`.
**Output:** `{ id, name, type, size, mimeType, lastModifiedDateTime, webUrl, parentPath }`.
**Endpoint:** `GET /me/drive/items/{id}` ou `/me/drive/root:/{path}:`.

#### `list_recent_files`
**Input:** `top`, `accountId`.
**Output:** lista de itens recentes.
**Endpoint:** `GET /me/drive/recent`.

#### `list_shared_with_me`
**Input:** `top`, `accountId`.
**Output:** itens compartilhados com o usuário.
**Endpoint:** `GET /me/drive/sharedWithMe`.

### Conteúdo

#### `download_file`
Baixa o conteúdo de um arquivo.
**Input:** `itemId` **ou** `path`, `accountId`.
**Output:** `{ name, mimeType, size, contentBase64 }` para arquivos pequenos, ou um
caminho local salvo para grandes (decisão de implementação; limite de inline ~4 MB).
**Endpoint:** `GET /me/drive/items/{id}/content`.

#### `upload_file`
Envia/atualiza um arquivo.
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `path` | string | Sim | Caminho destino (ex.: `/Documentos/nota.txt`). |
| `contentBase64` | string | Sim* | Conteúdo (arquivos pequenos). |
| `localFilePath` | string | Não* | Alternativa para arquivos grandes (upload session). |
| `conflictBehavior` | `rename`\|`replace`\|`fail` | Não | Default `replace`. |
| `accountId` | string | Não | |

**Comportamento:** ≤ 4 MB usa upload simples (`PUT .../content`); acima usa
**upload session** em chunks. (*um de `contentBase64`/`localFilePath`.)
**Output:** `{ id, name, size, webUrl }`.
**Endpoints:** `PUT /me/drive/root:/{path}:/content` (simples) ou
`POST /me/drive/root:/{path}:/createUploadSession` (grande).

### Organização

#### `create_folder`
**Input:** `parentPath` (opcional, default raiz) **ou** `parentId`, `name` (obrig.), `accountId`.
**Output:** `{ id, name, webUrl }`.
**Endpoint:** `POST /me/drive/root/children` (ou em `/{parent}/children`) body `{ name, folder: {} }`.

#### `move_item`
Move e/ou renomeia.
**Input:** `itemId` **ou** `path`, `destinationParentId` **ou** `destinationParentPath` (opcional), `newName` (opcional), `accountId`.
**Output:** `{ id, name, parentPath }`.
**Endpoint:** `PATCH /me/drive/items/{id}` body `{ parentReference, name }`.

#### `delete_item`
**Input:** `itemId` **ou** `path`, `accountId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE /me/drive/items/{id}`.

### Compartilhamento

#### `create_share_link`
Gera link de compartilhamento.
**Input:** `itemId` **ou** `path`, `type` (`view`|`edit`, default `view`), `scope` (`anonymous`|`organization`, default `anonymous`), `accountId`.
**Output:** `{ link, type, scope }`.
**Endpoint:** `POST /me/drive/items/{id}/createLink` body `{ type, scope }`.
**Edge case:** contas pessoais podem não permitir `scope: organization` →
erro `SCOPE_NOT_SUPPORTED`.

## Endpoints Graph (resumo)

| Tool | Método | Rota |
|---|---|---|
| list_drive_items | GET | `/me/drive/root[:/{path}:]/children` |
| search_drive | GET | `/me/drive/root/search(q='')` |
| get_drive_item | GET | `/me/drive/items/{id}` |
| list_recent_files | GET | `/me/drive/recent` |
| list_shared_with_me | GET | `/me/drive/sharedWithMe` |
| download_file | GET | `/me/drive/items/{id}/content` |
| upload_file | PUT/POST | `.../content` / `createUploadSession` |
| create_folder | POST | `.../children` |
| move_item | PATCH | `/me/drive/items/{id}` |
| delete_item | DELETE | `/me/drive/items/{id}` |
| create_share_link | POST | `/me/drive/items/{id}/createLink` |

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| `itemId` e `path` ausentes | Erro de validação `ITEM_REF_REQUIRED`. |
| Caminho inexistente | Erro `NOT_FOUND`. |
| Upload > 4 MB sem `localFilePath` | Tentar via `contentBase64` em session por chunks; se inviável, erro `USE_LOCAL_FILE_PATH`. |
| Conflito de nome em upload | Respeitar `conflictBehavior`. |
| Download de pasta | Erro `IS_A_FOLDER`. |
| `createLink` em conta pessoal com escopo org | Erro `SCOPE_NOT_SUPPORTED`. |

## Scopes
```
Files.ReadWrite
```
> Para SharePoint/drives de equipe (fora do escopo v1) seria necessário `Files.ReadWrite.All`.
