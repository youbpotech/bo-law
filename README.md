# Backoffice Jurídico

Semente de backoffice multiempresa para escritórios de advocacia, construída com Vue 3,
TypeScript, Express, TypeORM, Keycloak e PostgreSQL.

## Escopo inicial

- Autenticação e cadastros de empresas, usuários e clientes.
- Captação e qualificação de contatos por canal, inclusive WhatsApp.
- Entrevista comercial, reidratação em 30 dias e conversão de lead em cliente.
- Processo jurídico com esteira de execução e retorno para coleta documental.
- Processos NISS e AIMA registados no mesmo agregado `LegalCase` e associados ao cliente.
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
- Keycloak 26 para autenticação, usuários, roles e permissões de menu/processo.
- Integrações opcionais com OpenAI, Twilio e transcrição de áudio.

## Execução com Docker

Pré-requisitos: Docker com Docker Compose e Make.

```sh
make setup
# Defina POSTGRES_PASSWORD, KEYCLOAK_ADMIN_PASSWORD, BOOTSTRAP_ROOT_* e integrações no .env
make up
```

Serviços padrão:

- aplicação: `http://localhost:8080`;
- API: acessível pelo proxy em `/api`;
- Keycloak Admin: `http://127.0.0.1:8081`;
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
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=uma-senha-administrativa-forte
KEYCLOAK_REALM=bo-law
KEYCLOAK_CLIENT_ID=bo-law-api
BOOTSTRAP_ROOT_NAME=Administrador
BOOTSTRAP_ROOT_USERNAME=admin
BOOTSTRAP_ROOT_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
BOOTSTRAP_ROOT_COMPANY_ID=1
```

O bootstrap sincroniza o administrador com o Keycloak, atribui `platform-root` e a Role
`Root` da empresa. Cada empresa criada recebe automaticamente sua própria Role Root.
Depois da primeira sincronização, `BOOTSTRAP_ROOT_PASSWORD` pode ser removida; a credencial
permanece exclusivamente no Keycloak.

## Roles e permissões

### Integração NISS

Para habilitar o recurso NISS, configure no `.env` a URL e a chave da API HTTP do BotNiss:

```dotenv
BOTNISS_API_URL=http://host.docker.internal:3000
BOTNISS_API_KEY=uma_chave_aleatoria_com_pelo_menos_32_caracteres
```

O `bo-law` apenas consome essa API. Antes de solicitar o acompanhamento externo, cria um
`LegalCase` NISS associado ao cliente e envia o UUID desse processo como
`id_referencia_origem`. O BotNiss permanece um serviço independente e não é alterado
por este projeto.

### Acompanhamento de processos AIMA

O menu `Processos AIMA` consome a API independente do BotAIMA e associa cada URL de
tracking ao cliente da empresa atual. Configure a URL e a chave da API:

```dotenv
BOTAIMA_API_URL=http://host.docker.internal:3000
BOTAIMA_API_KEY=uma_chave_aleatoria_com_pelo_menos_32_caracteres
```

No desenvolvimento local, use `http://localhost:3000`. A API do backoffice mantém a
chave do BotAIMA no servidor, cria um `LegalCase` AIMA associado ao cliente, envia o UUID
desse processo como `id_referencia_origem`, valida o cliente/tenant antes de expor dossiês
e documentos e disponibiliza criação, consulta, reprocessamento e download dos snapshots
retornados. NISS e AIMA usam o mesmo contrato de processos; a integração externa apenas
complementa o agregado local.

O Keycloak contém as roles técnicas `dashboard`, `users`, `roles`, `clients`, `companies`,
`leads`, `cases`, `niss` e `aima`. O backoffice permite que usuários Root criem roles compostas por empresa
e as associem aos usuários. O mesmo acesso controla a visibilidade do menu e as respectivas
rotas da API; ocultar o menu não é usado como única barreira de segurança.

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

## Notificações omnichannel

O módulo `apps/api/src/notifications` mantém um catálogo único com os canais suportados
`internal`, `email`, `whatsapp` e `sms`. Todo utilizador possui preferências próprias;
`internal` é o padrão. A interface exibe sempre o catálogo completo e deixa esmaecidos os
canais não configurados, sem contacto compatível ou ainda não implementados.

Ao criar um processo geral, NISS ou AIMA, o criador é registado como stakeholder
obrigatório e não removível. Outros utilizadores da mesma empresa podem ser incluídos na
lista de stakeholders. Cada evento do processo resolve os canais atualmente habilitados
e disponíveis de cada participante; se todos os canais externos preferidos estiverem
indisponíveis, utiliza o alerta interno. Cada canal gera uma entrega independente, com
estado, número de tentativas, identificador do provedor e último erro. Falhas transitórias
são retomadas pelo worker.

Na listagem de processos, o botão de documentos abre os ficheiros disponíveis no processo
integrado. Processos gerais mantêm o respetivo estado documental, mas não apresentam
ficheiros enquanto não existir um repositório documental associado. A listagem de
utilizadores oferece um atalho para filtrar os processos em que cada utilizador é
stakeholder e aceder aos respetivos documentos.

Serviços da aplicação devem solicitar notificações pela função `notify`:

```ts
await notify({
  companyId,
  createdByUserId,
  recipient: {
    userId,
    email: 'destinatario@example.com',
    phone: '+351912345678',
  },
  channels: new Set(['internal', 'email', 'whatsapp']),
  title: 'Documento disponível',
  body: 'O documento solicitado já está disponível.',
  metadata: { documentId },
})
```

`userId` é obrigatório para o canal interno. O email pode ser informado diretamente ou
obtido do usuário. O telefone deve ser informado para WhatsApp. O adapter de WhatsApp
reutiliza o transporte Twilio dos leads, sem alterar conversas ou webhooks existentes.

Para habilitar email real em produção, configure:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
NOTIFICATION_EMAIL_FROM=Backoffice <nao-responder@example.com>
NOTIFICATION_WORKER_POLL_MS=3000
NOTIFICATION_MAX_ATTEMPTS=5
```

O SMS integra o catálogo suportado, mas permanece indisponível para seleção e entrega até
existir um adapter. O `.env.example` mantém o contrato reservado ao canal
(`SMS_PROVIDER`, `SMS_API_BASE_URL`, `SMS_API_KEY`, `SMS_API_SECRET` e `SMS_FROM`).
Essas variáveis somente serão consumidas quando o respectivo adapter for implementado.

As notificações internas do usuário autenticado estão disponíveis em
`GET /api/notifications`. Use `PATCH /api/notifications/:id/read` para marcar uma
notificação como lida e `PATCH /api/notifications/read-all` para marcar todas.
No cabeçalho, o botão de notificações ao lado do seletor de tema exibe a quantidade
pendente e abre o inbox flutuante. O botão com polegar registra a ciência do usuário
utilizando a rota individual de leitura.

Quando a empresa não possui banner de login ou logomarca próprios, o frontend utiliza
os assets versionados em `apps/web/public/branding`. As imagens personalizadas continuam
armazenadas por empresa e sempre têm precedência sobre esses padrões.

Para ativar o SMS futuramente, implemente `NotificationChannelAdapter`, registe-o na
factory e faça o catálogo marcá-lo como implementado e configurado. O identificador e os
contratos de persistência já existem.

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
