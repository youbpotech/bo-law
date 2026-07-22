# API do Backoffice Jurídico

API Express com TypeORM, PostgreSQL e autenticação/autorização via Keycloak.

## Rotas principais

- `POST /api/auth/login`, `GET /api/me`.
- CRUD de `/api/users`, `/api/roles`, `/api/clients` e `/api/companies`.
- `GET|PUT /api/dashboard` e `GET /api/dashboard/stats`.
- `GET|POST /api/leads`, detalhe, qualificação, atendimento e conversão.
- `GET|POST /api/cases`, transições de execução e atualização das faturas 30%/70%.
- `POST /api/webhooks/twilio/whatsapp`.

Todas as rotas de negócio autenticadas são limitadas à empresa do usuário. Rotas de
empresas e troca de tenant exigem administrador global. Cadastros de roles e usuários
exigem a Role Root da empresa. Cada rota de negócio também valida sua role técnica.

## Banco e migrations

```env
POSTGRES_DB=bo_law
POSTGRES_USER=postgres
POSTGRES_PASSWORD=troque-esta-senha
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=troque-esta-senha
KEYCLOAK_REALM=bo-law
KEYCLOAK_CLIENT_ID=bo-law-api
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

Não há credencial de usuário embutida. O bootstrap cria ou sincroniza o administrador no
Keycloak e garante as roles Root das empresas existentes.

## Scripts

```sh
pnpm --filter @bo-law/api build
pnpm --filter @bo-law/api type-check
pnpm --filter @bo-law/api test
```
