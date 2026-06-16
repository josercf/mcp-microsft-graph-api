# 04 — To-Do

> Status: 📝 Draft

## Objetivo

Gerenciar o Microsoft To-Do das contas: **gestão completa das diferentes listas**
(criar, renomear, excluir, listar) e das tarefas dentro delas (CRUD, subtarefas,
prazos, lembretes, recorrência, conclusão e movimentação entre listas).

## Conceitos

- **Lista (`todoTaskList`)** — agrupador de tarefas. Há listas de sistema (ex.:
  "Tasks" padrão, "Flagged Email") e listas criadas pelo usuário. Cada lista tem
  `id`, `displayName`, `wellknownListName` e `isOwner`.
- **Tarefa (`todoTask`)** — item com `title`, `status`, `importance`, `dueDateTime`,
  `reminderDateTime`, `body` (notas), `recurrence`, `categories` e **subtarefas**.
- **Subtarefa (`checklistItem`)** — item de checklist dentro de uma tarefa.

> O Graph **não** possui endpoint nativo "mover tarefa entre listas". A tool
> `move_task` implementa isso recriando a tarefa (e suas subtarefas) na lista
> destino e excluindo a original — comportamento explicitado ao usuário.

## User Stories

- Como usuário, quero **listar todas as minhas listas**, para saber onde estão as tarefas.
- Como usuário, quero **criar, renomear e excluir listas**, para organizar por projeto/contexto.
- Como usuário, quero **listar tarefas** de uma lista (filtrando por status).
- Como usuário, quero **criar tarefas** com prazo, lembrete, importância e notas.
- Como usuário, quero **concluir** e **reabrir** tarefas.
- Como usuário, quero **atualizar** detalhes de uma tarefa.
- Como usuário, quero **adicionar subtarefas** (checklist) a uma tarefa.
- Como usuário, quero **mover uma tarefa** de uma lista para outra.
- Como usuário, quero **excluir** tarefas.

## Tools MCP

> Todas aceitam `accountId` opcional (default account).

### Listas

#### `list_task_lists`
**Input:** `accountId`.
**Output:** `[{ id, displayName, wellknownListName, isOwner, isShared }]`.
**Endpoint:** `GET /me/todo/lists`.

#### `create_task_list`
**Input:** `displayName` (obrig.), `accountId`.
**Output:** `{ id, displayName }`.
**Endpoint:** `POST /me/todo/lists`.

#### `rename_task_list`
**Input:** `listId` (obrig.), `displayName` (obrig.), `accountId`.
**Output:** `{ id, displayName }`.
**Endpoint:** `PATCH /me/todo/lists/{listId}`.

#### `delete_task_list`
**Input:** `listId` (obrig.), `accountId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE /me/todo/lists/{listId}`.
**Edge case:** listas de sistema (`wellknownListName` != `none`) podem não ser
deletáveis → erro `CANNOT_DELETE_SYSTEM_LIST`.

### Tarefas

#### `list_tasks`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `listId` | string | Sim | Lista. |
| `status` | `all`\|`open`\|`completed` | Não | Default `open`. |
| `top` | number | Não | Default 50. |
| `skipToken` | string | Não | |
| `accountId` | string | Não | |

**Output:** `[{ id, title, status, importance, dueDateTime, reminderDateTime, isReminderOn, hasSubtasks, categories[] }]` + `nextLink`.
**Endpoint:** `GET /me/todo/lists/{listId}/tasks` (filtro `$filter=status eq 'notStarted'` para open).

#### `get_task`
**Input:** `listId`, `taskId`, `accountId`.
**Output:** tarefa completa + `body`, `recurrence`, e subtarefas (`checklistItems`).
**Endpoint:** `GET /me/todo/lists/{listId}/tasks/{taskId}` (+ `/checklistItems`).

#### `create_task`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `listId` | string | Sim | |
| `title` | string | Sim | |
| `dueDateTime` | string (ISO) | Não | |
| `reminderDateTime` | string (ISO) | Não | |
| `importance` | `low`\|`normal`\|`high` | Não | |
| `body` | string | Não | Notas. |
| `categories` | string[] | Não | |
| `recurrence` | object | Não | Igual modelo do calendário (03). |
| `accountId` | string | Não | |

**Output:** `{ id, title, status }`.
**Endpoint:** `POST /me/todo/lists/{listId}/tasks`.

#### `update_task`
PATCH parcial.
**Input:** `listId`, `taskId` + campos a alterar, `accountId`.
**Output:** tarefa (resumo).
**Endpoint:** `PATCH /me/todo/lists/{listId}/tasks/{taskId}`.

#### `complete_task`
Atalho para concluir/reabrir.
**Input:** `listId`, `taskId`, `completed` (bool, default true), `accountId`.
**Comportamento:** seta `status` para `completed` ou `notStarted`.
**Output:** `{ id, status }`.
**Endpoint:** `PATCH /me/todo/lists/{listId}/tasks/{taskId}`.

#### `delete_task`
**Input:** `listId`, `taskId`, `accountId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE /me/todo/lists/{listId}/tasks/{taskId}`.

#### `move_task`
Move tarefa entre listas (recria + exclui).
**Input:** `sourceListId`, `taskId`, `destinationListId`, `accountId`.
**Comportamento:**
1. Lê tarefa origem + subtarefas.
2. Cria cópia na lista destino (preservando título, prazo, importância, notas, subtarefas, status).
3. Exclui a tarefa original.
4. Em caso de falha na exclusão, não deixa duplicata órfã silenciosa: retorna aviso.

**Output:** `{ movedTaskId, sourceListId, destinationListId }`.
**Endpoints:** `GET` origem, `POST` destino, `DELETE` origem.

### Subtarefas

#### `list_subtasks`
**Input:** `listId`, `taskId`, `accountId`.
**Output:** `[{ id, displayName, isChecked }]`.
**Endpoint:** `GET /me/todo/lists/{listId}/tasks/{taskId}/checklistItems`.

#### `add_subtask`
**Input:** `listId`, `taskId`, `displayName` (obrig.), `accountId`.
**Output:** `{ id, displayName, isChecked }`.
**Endpoint:** `POST /me/todo/lists/{listId}/tasks/{taskId}/checklistItems`.

#### `update_subtask`
**Input:** `listId`, `taskId`, `checklistItemId`, `displayName` (opcional), `isChecked` (opcional), `accountId`.
**Output:** `{ id, displayName, isChecked }`.
**Endpoint:** `PATCH .../checklistItems/{id}`.

#### `delete_subtask`
**Input:** `listId`, `taskId`, `checklistItemId`, `accountId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE .../checklistItems/{id}`.

## Endpoints Graph (resumo)

| Tool | Método | Rota |
|---|---|---|
| list/create/rename/delete list | GET/POST/PATCH/DELETE | `/me/todo/lists[/{id}]` |
| list/get/create/update/delete task | GET/POST/PATCH/DELETE | `/me/todo/lists/{l}/tasks[/{id}]` |
| complete_task | PATCH | `/me/todo/lists/{l}/tasks/{id}` |
| move_task | GET+POST+DELETE | (composto) |
| subtasks | GET/POST/PATCH/DELETE | `.../tasks/{id}/checklistItems[/{c}]` |

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| `listId`/`taskId` inexistente | Erro `NOT_FOUND`. |
| Deletar lista de sistema | Erro `CANNOT_DELETE_SYSTEM_LIST`. |
| `move_task` com falha pós-cópia | Não excluir origem; retornar `MOVE_PARTIAL` com ambos os IDs. |
| `dueDateTime` no passado | Permitido (Graph aceita); sem erro. |
| Recorrência sem `dueDateTime` | Graph exige due para recorrer → erro de validação `RECURRENCE_REQUIRES_DUE`. |

## Scopes
```
Tasks.ReadWrite
```
