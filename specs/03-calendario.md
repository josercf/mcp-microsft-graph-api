# 03 — Calendário

> Status: 📝 Draft

## Objetivo

Gerenciar calendário das contas: visualizar agenda por período, criar/editar/excluir
eventos, gerenciar convidados e responder a convites, com suporte a múltiplos
calendários e fusos horários.

## Conceitos

- **Calendário** — um usuário tem um calendário padrão e pode ter vários
  (`/me/calendars`). Eventos pertencem a um calendário.
- **Evento** — possui início/fim com `timeZone`, assunto, corpo, local, organizador,
  participantes (`attendees`), recorrência, status de resposta e flag `isAllDay`.
- **calendarView** — projeção de eventos em um intervalo, **expandindo recorrências**
  em ocorrências individuais (preferível a `/events` para "o que tenho na semana").
- **Fuso horário** — entrada/saída usam `timeZone` IANA. Default configurável.

## User Stories

- Como usuário, quero ver minha **agenda de um período** (hoje, semana), para me planejar.
- Como usuário, quero **criar** um evento com participantes, local e lembrete.
- Como usuário, quero **convidar pessoas** e que recebam o convite.
- Como usuário, quero **atualizar** horário/detalhes de um evento.
- Como usuário, quero **cancelar/excluir** um evento.
- Como usuário, quero **aceitar, recusar ou marcar como tentativo** convites recebidos.
- Como usuário, quero **listar meus calendários** e operar em um específico.
- Como usuário, quero **verificar disponibilidade** (horários livres) antes de marcar.

## Tools MCP

> Todas aceitam `accountId` opcional e `calendarId` opcional (default: calendário padrão).

### `list_events`
Lista eventos em um intervalo (usa calendarView, expande recorrências).
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `startDateTime` | string (ISO) | Sim | Início do intervalo. |
| `endDateTime` | string (ISO) | Sim | Fim do intervalo. |
| `timeZone` | string | Não | IANA. Default: config/UTC. |
| `calendarId` | string | Não | |
| `top` | number | Não | Default 50. |
| `accountId` | string | Não | |

**Output:** `[{ id, subject, start, end, isAllDay, location, organizer, attendees[] (nome, email, status), onlineMeetingUrl, responseStatus }]`.
**Endpoint:** `GET /me/calendarView?startDateTime=&endDateTime=` (header `Prefer: outlook.timezone`).

### `get_event`
**Input:** `eventId` (obrig.), `accountId`, `calendarId`.
**Output:** evento completo (campos acima + `body`, `recurrence`, `categories`).
**Endpoint:** `GET /me/events/{id}`.

### `create_event`
**Input:**
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `subject` | string | Sim | |
| `start` | string (ISO) | Sim | |
| `end` | string (ISO) | Sim | |
| `timeZone` | string | Não | IANA. |
| `isAllDay` | boolean | Não | |
| `body` | string | Não | Descrição. |
| `location` | string | Não | |
| `attendees` | array | Não | `{ email, name?, type? (required\|optional) }`. |
| `isOnlineMeeting` | boolean | Não | Cria reunião Teams. |
| `reminderMinutesBeforeStart` | number | Não | |
| `recurrence` | object | Não | Padrão de recorrência (ver abaixo). |
| `calendarId` | string | Não | |
| `accountId` | string | Não | |

**Output:** `{ id, subject, start, end, webLink, onlineMeetingUrl }`.
**Endpoint:** `POST /me/events` (ou `/me/calendars/{id}/events`).

### `update_event`
Atualiza campos de um evento (PATCH parcial).
**Input:** `eventId` (obrig.) + quaisquer campos de `create_event` a alterar, `accountId`.
**Output:** evento atualizado (resumo).
**Endpoint:** `PATCH /me/events/{id}`.

### `delete_event`
**Input:** `eventId`, `accountId`, `calendarId`.
**Output:** `{ deleted: true }`.
**Endpoint:** `DELETE /me/events/{id}`.

### `respond_to_event`
Responde a um convite recebido.
**Input:** `eventId` (obrig.), `response` (`accept`|`decline`|`tentativelyAccept`), `comment` (opcional), `sendResponse` (bool, default true), `accountId`.
**Output:** `{ responded: true, response }`.
**Endpoint:** `POST /me/events/{id}/accept|decline|tentativelyAccept`.

### `list_calendars`
**Input:** `accountId`.
**Output:** `[{ id, name, color, isDefaultCalendar, canEdit, owner }]`.
**Endpoint:** `GET /me/calendars`.

### `find_meeting_times`
Sugere horários livres comuns entre participantes.
**Input:** `attendees` (string[] emails), `durationMinutes` (number), `timeWindowStart` (ISO), `timeWindowEnd` (ISO), `accountId`.
**Output:** `[{ start, end, confidence }]`.
**Endpoint:** `POST /me/findMeetingTimes`.

### `get_schedule` _(opcional v1.1)_
Consulta free/busy de pessoas/salas.
**Input:** `schedules` (string[] emails), `startTime`, `endTime`, `intervalMinutes`, `accountId`.
**Output:** disponibilidade por pessoa.
**Endpoint:** `POST /me/calendar/getSchedule`.

## Modelo de recorrência (`recurrence`)

```json
{
  "pattern": { "type": "weekly", "interval": 1, "daysOfWeek": ["monday","wednesday"] },
  "range":   { "type": "endDate", "startDate": "2026-06-16", "endDate": "2026-12-31" }
}
```
Tipos de `pattern`: `daily`, `weekly`, `absoluteMonthly`, `relativeMonthly`,
`absoluteYearly`, `relativeYearly`. Tipos de `range`: `endDate`, `noEnd`, `numbered`.

## Endpoints Graph (resumo)

| Tool | Método | Rota |
|---|---|---|
| list_events | GET | `/me/calendarView` |
| get_event | GET | `/me/events/{id}` |
| create_event | POST | `/me/events` |
| update_event | PATCH | `/me/events/{id}` |
| delete_event | DELETE | `/me/events/{id}` |
| respond_to_event | POST | `/me/events/{id}/{accept\|decline\|tentativelyAccept}` |
| list_calendars | GET | `/me/calendars` |
| find_meeting_times | POST | `/me/findMeetingTimes` |
| get_schedule | POST | `/me/calendar/getSchedule` |

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| `end` antes de `start` | Erro de validação `INVALID_RANGE`. |
| Intervalo de `list_events` muito grande | Limitar a, por ex., 31 dias; acima disso erro/aviso. |
| `respond_to_event` em evento que o usuário organiza | Graph rejeita; erro `CANNOT_RESPOND_OWN_EVENT`. |
| `timeZone` inválido | Erro `INVALID_TIMEZONE`. |
| Editar ocorrência única de série recorrente | Suportar via `eventId` da ocorrência (Graph expande em calendarView). Documentar limitação na v1. |
| `isAllDay=true` com horários | start/end devem ser meia-noite; normalizar ou erro. |

## Scopes
```
Calendars.ReadWrite
```
