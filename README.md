# Backoffice Jurídico

Semente de backoffice multiempresa para escritórios de advocacia, construída com Vue 3,
TypeScript, Express, TypeORM e PostgreSQL.

## Escopo inicial

- Autenticação e cadastros de empresas, usuários e clientes.
- Captação e qualificação de contatos por canal, inclusive WhatsApp.
- Entrevista comercial, reidratação em 30 dias e conversão de lead em cliente.
- Processo jurídico com esteira de execução e retorno para coleta documental.
- Faturação parcial de 30% e final de 70%.
- Dashboard cujos indicadores visíveis são configuráveis por empresa.

O catálogo, as recomendações, os dossiês públicos e as APIs de imóveis foram removidos.
O modelo intencionalmente não implementa um motor BPMN genérico: o estado do `Lead`, do
`LegalCase` e de suas duas `Invoice` representa o fluxo inicial com menos complexidade.
Veja [docs/legal-workflow.md](docs/legal-workflow.md) para o contrato de domínio.

## Tecnologias

- Vue 3, Composition API, Tailwind CSS e componentes shadcn/ui.
- TanStack Query, Pinia, Vue Router e Vue i18n.
- Express 5, TypeORM e PostgreSQL 18.
- Integrações opcionais com OpenAI, Twilio e transcrição de áudio.

## Execução com Docker

Pré-requisitos: Docker com Docker Compose e Make.

```sh
make setup
# Defina senhas, AUTH_SECRET, BOOTSTRAP_ROOT_* e integrações no .env
make up
```

Serviços padrão:

- aplicação: `http://localhost:8080`;
- API: acessível pelo proxy em `/api`;
- pgAdmin opcional: `make pgadmin`, disponível apenas em `http://127.0.0.1:5050`.

No primeiro acesso ao pgAdmin, registre o servidor `db`, porta `5432`, com os valores
`POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` do `.env`.

```sh
make logs
make down
```

Os dados persistem no volume `postgres_data`. `make destroy CONFIRM=1` remove os volumes
de forma irreversível.

## Acesso inicial

Não existe credencial conhecida embutida. Na primeira execução, configure no `.env`:

```env
AUTH_SECRET=um-segredo-aleatorio-com-pelo-menos-32-caracteres
BOOTSTRAP_ROOT_NAME=Administrador
BOOTSTRAP_ROOT_USERNAME=admin
BOOTSTRAP_ROOT_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
BOOTSTRAP_ROOT_COMPANY_ID=1
```

O bootstrap cria o root somente quando ainda não existe nenhum. Depois do primeiro acesso,
remova `BOOTSTRAP_ROOT_PASSWORD` do ambiente; reinícios posteriores preservam o usuário.

## Leads e WhatsApp

Configure a empresa destinatária com seu número de WhatsApp no cadastro de empresas. O
webhook usa o campo `To` enviado pela Twilio para isolar o lead no tenant correto. Para
uma instalação simples com um remetente global, `LEADS_DEFAULT_COMPANY_ID` define o
fallback explícito.

```env
OPENAI_API_KEY=
AUDIO_TRANSCRIPTION_ENABLED=true
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PUBLIC_BACKEND_URL=https://seu-endereco-publico.example
VALIDATE_TWILIO_SIGNATURE=true
LEADS_DEFAULT_COMPANY_ID=
```

Webhook Twilio:

```text
POST https://seu-endereco-publico.example/api/webhooks/twilio/whatsapp
```

Sem OpenAI, a triagem usa extrações e perguntas determinísticas. Sem credenciais Twilio,
o envio manual permanece disponível em modo de desenvolvimento com SID simulado.
Para desenvolvimento local sem callbacks reais da Twilio, desative a validação de assinatura
explicitamente. Preencha `LEADS_DEFAULT_COMPANY_ID` apenas em instalações de empresa única;
em ambientes multiempresa, mantenha-o vazio e configure o WhatsApp de cada empresa.

## Verificação

```sh
make test
make lint
make type-check
make verify
make build
```

Sem Docker, após `pnpm install --frozen-lockfile`:

```sh
pnpm lint:check
pnpm type-check
pnpm test
pnpm build
```

## Estrutura

```text
apps/
├── api/       # API, entidades, migrations e integrações
└── web/       # painel Vue
docs/          # fluxo de domínio e implantação
docker/        # configuração do Nginx
```
