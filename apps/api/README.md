# API do Backoffice Jurídico

API Express com TypeORM e PostgreSQL. A configuração principal fica no `.env` da raiz.

## Rotas principais

- `POST /api/auth/login`, `GET /api/me`.
- CRUD de `/api/users`, `/api/clients` e `/api/companies`.
- `GET|PUT /api/dashboard` e `GET /api/dashboard/stats`.
- `GET|POST /api/leads`, detalhe, qualificação, atendimento e conversão.
- `GET|POST /api/cases`, transições de execução e atualização das faturas 30%/70%.
- `POST /api/webhooks/twilio/whatsapp`.

Todas as rotas de negócio autenticadas são limitadas à empresa do usuário. Rotas de
empresas, troca de tenant e mutações de usuários exigem usuário root.

## Banco e migrations

```env
POSTGRES_DB=bo_law
POSTGRES_USER=postgres
POSTGRES_PASSWORD=troque-esta-senha
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
AUTH_SECRET=troque-por-um-segredo-longo-e-aleatorio
BOOTSTRAP_ROOT_NAME=Administrador
BOOTSTRAP_ROOT_USERNAME=admin
BOOTSTRAP_ROOT_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
BOOTSTRAP_ROOT_COMPANY_ID=1
```

No Docker, o host interno é `db`. Para executar a migration compilada:

```sh
make migrate
pnpm --filter @bo-law/api bootstrap:root
```

Não há credencial conhecida embutida. O bootstrap cria o primeiro root a partir do ambiente
e torna-se um no-op assim que um usuário root existe.

## Scripts

```sh
pnpm --filter @bo-law/api build
pnpm --filter @bo-law/api type-check
pnpm --filter @bo-law/api test
```
