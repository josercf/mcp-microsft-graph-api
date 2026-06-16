# 05 — Contatos

> Status: 📝 Draft

## Objetivo

Gerenciar contatos das contas: listar, buscar, criar, atualizar e excluir contatos,
servindo de apoio às demais features (ex.: resolver nomes para endereços de email ao
compor mensagens ou convidar para reuniões).

## Conceitos

- **Contato (`contact`)** — pessoa na agenda do usuário, com `displayName`,
  `emailAddresses[]`, `businessPhones[]`, `mobilePhone`, `companyName`, `jobTitle`,
  endereços, etc.
- **Pasta de contatos** — contatos podem estar em pastas (`/me/contactFolders`).
  v1 opera na pasta padrão; pastas customizadas ficam para v1.1.

## User Stories

- Como usuário, quero **listar** meus contatos.
- Como usuário, quero **buscar** um contato por nome ou email, para usar em emails/eventos.
- Como usuário, quero **criar** um contato.
- Como usuário, quero **atualizar** dados de um contato.
- Como usuário, quero **excluir** um contato.

## Tools MCP

> Todas aceitam `accountId` opcional (default account).

### `list_contacts`
**Input:** `top` (default 50), `skipToken`, `accountId`.
**Output:** `[{ id, displayName, emailAddresses[], mobilePhone, companyName, jobTitle }]` + `nextLink`.
**Endpoint:** `GET /me/contacts?$select=...&$top=...&$orderby=displayName`.

### `search_contacts`
Busca por nome ou email.
**Input:** `query` (obrig.), `top`, `accountId`.
**Output:** mesma estrutura de `list_contacts`.
**Endpoint:** `GET /me/contacts?$filter=startswith(displayName,'{q}') or emailAddresses/any(e:e/address eq '{q}')`
(ou `$search="{q}"` com header `ConsistencyLevel: eventual`).

### `get_contact`
**Input:** `contactId` (obrig.), `accountId`.
**Output:** contato completo (todos os campos relevantes).
**Endpoint:** `GET /me/contacts/{id}`.

### `create_contact`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `givenName` | string | Não* | Nome. |
| `surname` | string | Não* | Sobrenome. |
| `displayName` | string | Não* | Nome de exibição. (*ao menos um identificador) |
| `emailAddresses` | array | Não | `{ address, name? }`. |
| `mobilePhone` | string | Não | |
| `businessPhones` | string[] | Não | |
| `companyName` | string | Não | |
| `jobTitle` | string | Não | |
| `accountId` | string | Não | |

**Output:** `{ id, displayName }`.
**Endpoint:** `POST /me/contacts`.

### `update_contact`
PATCH parcial.
**Input:** `contactId` (obrig.) + campos a alterar, `accountId`.
**Output:** contato (resumo).
**Endpoint:** `PATCH /me/contacts/{id}`.

### `delete_contact`
**Input:** `contactId` (obrig.), `accountId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE /me/contacts/{id}`.

## Endpoints Graph (resumo)

| Tool | Método | Rota |
|---|---|---|
| list_contacts | GET | `/me/contacts` |
| search_contacts | GET | `/me/contacts?$filter`/`$search` |
| get_contact | GET | `/me/contacts/{id}` |
| create_contact | POST | `/me/contacts` |
| update_contact | PATCH | `/me/contacts/{id}` |
| delete_contact | DELETE | `/me/contacts/{id}` |

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| `contactId` inexistente | Erro `NOT_FOUND`. |
| `create_contact` sem nenhum identificador | Erro de validação `CONTACT_NEEDS_NAME`. |
| `$search` sem header `ConsistencyLevel` | Adicionar header automaticamente. |
| Email malformado em `emailAddresses` | Erro de validação `INVALID_EMAIL`. |

## Scopes
```
Contacts.ReadWrite
```
