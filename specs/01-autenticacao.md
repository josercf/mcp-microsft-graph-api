# 01 — Autenticação & Multi-conta

> Status: 📝 Draft

## Objetivo

Permitir que o usuário conecte **uma ou mais contas Microsoft** (pessoais e/ou
corporativas) ao servidor MCP usando o **Device Code Flow**, e que escolha sobre
qual conta cada operação é executada. Tokens são persistidos e renovados
automaticamente (refresh token), sem reautenticação a cada uso.

## Por que Device Code Flow

O MCP roda em um processo CLI/servidor, sem navegador embutido e, possivelmente,
sem servidor web para callback. O Device Code Flow resolve isso:

1. O usuário pede para adicionar uma conta.
2. O MCP retorna uma URL (`https://microsoft.com/devicelogin`) e um código curto.
3. O usuário abre a URL em qualquer dispositivo, insere o código e autentica.
4. O MCP faz polling e, ao concluir, recebe os tokens e salva no cache.

Sem segredo de cliente (public client), sem servidor de redirect.

## Conceitos

### Conta (`account`)
Uma identidade Microsoft autenticada. Cada conta tem:
- `accountId` — identificador estável e único (homeAccountId do MSAL).
- `username` — email/UPN da conta (ex.: `joao@empresa.com`).
- `name` — nome de exibição.
- `tenantId` — `consumers` para pessoal, GUID para corporativa.
- `type` — `personal` | `work`.
- `isDefault` — se é a conta padrão.

### Conta padrão (default account)
Quando uma tool é chamada **sem** `accountId`, usa-se a conta padrão. A primeira
conta adicionada vira padrão automaticamente. Pode ser trocada com `set_default_account`.

### Cache de tokens
O MSAL serializa seu cache (contas + refresh tokens + access tokens) em um arquivo
JSON no caminho de `GRAPH_TOKEN_CACHE_PATH`. O arquivo é sensível — ver Segurança.

## User Stories

- Como usuário, quero **adicionar** minha conta pessoal e a corporativa, para
  gerenciar ambas pelo assistente.
- Como usuário, quero **listar** as contas conectadas, para saber o que está disponível.
- Como usuário, quero **escolher** sobre qual conta uma ação acontece, para não
  misturar email pessoal com corporativo.
- Como usuário, quero **definir uma conta padrão**, para não repetir o `accountId` toda vez.
- Como usuário, quero **remover** uma conta, para revogar o acesso local.

## Tools MCP

### `add_account`
Inicia o Device Code Flow para conectar uma nova conta.

**Input:**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `tenant` | string | Não | Override do tenant: `common`/`consumers`/`organizations`/GUID. Default: config. |

**Comportamento:**
1. Inicia device code; retorna **imediatamente** a mensagem de verificação ao usuário
   (URL + código + instrução), pois é assíncrono.
2. Faz polling em background até o usuário autenticar ou expirar.
3. Ao concluir, persiste a conta e a torna padrão se for a primeira.

**Output:**
```json
{
  "verification": {
    "url": "https://microsoft.com/devicelogin",
    "userCode": "ABCD-1234",
    "message": "Acesse a URL e digite o código ABCD-1234.",
    "expiresInSeconds": 900
  },
  "status": "pending"
}
```
Após conclusão (consultável via `list_accounts` ou tool retorna estado final se
aguardar): `{ "status": "connected", "account": { ...account } }`.

> **Nota de implementação:** como o device code é interativo e pode levar minutos,
> a tool pode (a) retornar `pending` e instruir o usuário a confirmar depois, ou
> (b) aguardar a conclusão dentro do timeout do MCP. Decisão de implementação a
> definir na fase 1; a spec exige no mínimo expor a mensagem de verificação ao usuário.

---

### `list_accounts`
Lista todas as contas conectadas.

**Input:** _(nenhum)_

**Output:**
```json
{
  "accounts": [
    {
      "accountId": "abc-home-id",
      "username": "joao@outlook.com",
      "name": "João R.",
      "type": "personal",
      "tenantId": "consumers",
      "isDefault": true
    }
  ],
  "defaultAccountId": "abc-home-id"
}
```

---

### `set_default_account`
Define qual conta é a padrão.

**Input:**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `accountId` | string | Sim | Conta a tornar padrão. |

**Output:** `{ "defaultAccountId": "..." }`

---

### `remove_account`
Remove uma conta do cache local (revoga acesso local; não revoga consentimento no Azure).

**Input:**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `accountId` | string | Sim | Conta a remover. |

**Comportamento:** remove a conta e seus tokens do cache. Se era a padrão, promove
a próxima conta disponível (se houver) a padrão.

**Output:** `{ "removed": true, "newDefaultAccountId": "..." | null }`

---

### `whoami`
Retorna o perfil da conta (default ou informada) para confirmar identidade.

**Input:**
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `accountId` | string | Não | Conta a inspecionar. Default: conta padrão. |

**Output:**
```json
{ "id": "...", "displayName": "João R.", "mail": "joao@outlook.com", "userPrincipalName": "joao@outlook.com" }
```
**Endpoint:** `GET /me`

## Resolução de token (interno, todas as tools)

Pseudo-fluxo executado por qualquer tool que precise de acesso:
1. Resolver `accountId` (parâmetro → default → erro `NO_ACCOUNT` se nenhum).
2. Localizar a conta no cache MSAL.
3. `acquireTokenSilent` (usa cache/refresh token).
4. Se falhar com `InteractionRequired`, retornar erro acionável instruindo
   `add_account` novamente para reautenticar.

## Endpoints Graph
- `GET /me` (whoami).
- Demais operações de auth são locais (MSAL + cache).

## Edge cases & erros

| Situação | Comportamento |
|---|---|
| Nenhuma conta conectada e tool sem `accountId` | Erro `NO_ACCOUNT`: "Nenhuma conta conectada. Use `add_account`." |
| `accountId` inexistente | Erro `ACCOUNT_NOT_FOUND`. |
| Device code expira sem autenticação | Erro `DEVICE_CODE_EXPIRED`: instruir novo `add_account`. |
| Refresh token revogado/expirado | Erro `REAUTH_REQUIRED`: instruir `add_account`. |
| Mesma conta adicionada duas vezes | Idempotente: atualiza tokens, não duplica. |
| Cache corrompido/ilegível | Inicia cache vazio e loga aviso; não derruba o servidor. |

## Scopes
```
User.Read
offline_access
```
(Os demais scopes de cada módulo são solicitados no mesmo consentimento inicial —
ver specs específicas. O consentimento abrange o conjunto completo de scopes.)

## Segurança

- O arquivo de cache contém **refresh tokens** — deve ter permissão `600` (somente
  o dono lê/escreve). A implementação deve criar o arquivo com essas permissões.
- O `GRAPH_CLIENT_ID` não é segredo (public client), mas não deve ser commitado;
  vem de env var.
- Nenhum token é incluído em saídas de tools ou logs.
- `remove_account` apaga material sensível do cache; documentar que **não** revoga
  o consentimento no portal Azure (orientar o usuário a revogar em
  https://myapps.microsoft.com se desejar revogação total).
