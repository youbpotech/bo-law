SHELL := /bin/sh

ENV_FILE ?= .env
COMPOSE := docker compose --env-file $(ENV_FILE)

.DEFAULT_GOAL := help

.PHONY: help setup check up pgadmin start stop down restart build rebuild logs ps \
	test lint type-check verify migrate shell-api shell-db clean destroy

help: ## Exibe os comandos disponíveis
	@awk 'BEGIN {FS = ":.*## "; printf "Uso: make <comando>\n\nComandos:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Cria o arquivo local de configuração, caso não exista
	@if [ ! -f "$(ENV_FILE)" ]; then \
		cp .env.example "$(ENV_FILE)"; \
		printf 'Arquivo %s criado. Revise as senhas antes de usar em produção.\n' "$(ENV_FILE)"; \
	fi

check: setup ## Valida Docker e a configuração do Compose
	@docker info >/dev/null 2>&1 || { printf 'Docker não está em execução.\n'; exit 1; }
	@$(COMPOSE) config --quiet
	@printf 'Configuração válida.\n'

up: check ## Constrói e inicia todos os serviços
	@$(COMPOSE) up --build --detach
	@printf 'Aplicação disponível em http://localhost:%s\n' "$$(sed -n 's/^APP_PORT=//p' $(ENV_FILE) | tail -n 1)"

pgadmin: check ## Inicia o pgAdmin opcional, acessível apenas no computador local
	@test -n "$$(sed -n 's/^PGADMIN_EMAIL=//p' $(ENV_FILE) | tail -n 1)" || { printf 'Defina PGADMIN_EMAIL em %s.\n' "$(ENV_FILE)"; exit 1; }
	@test -n "$$(sed -n 's/^PGADMIN_PASSWORD=//p' $(ENV_FILE) | tail -n 1)" || { printf 'Defina PGADMIN_PASSWORD em %s.\n' "$(ENV_FILE)"; exit 1; }
	@$(COMPOSE) --profile tools up --detach pgadmin
	@port="$$(sed -n 's/^PGADMIN_PORT=//p' $(ENV_FILE) | tail -n 1)"; \
		printf 'pgAdmin disponível somente em http://127.0.0.1:%s\n' "$${port:-5050}"

start: check ## Inicia os containers existentes
	@$(COMPOSE) start

stop: setup ## Para os containers sem removê-los
	@$(COMPOSE) stop

down: setup ## Para e remove os containers
	@$(COMPOSE) down --remove-orphans

restart: down up ## Recria e reinicia a aplicação

build: check ## Constrói as imagens
	@$(COMPOSE) build

rebuild: check ## Reconstrói as imagens sem cache
	@$(COMPOSE) build --no-cache

logs: setup ## Acompanha os logs de todos os serviços
	@$(COMPOSE) logs --follow --tail=200

ps: setup ## Exibe o estado dos serviços
	@$(COMPOSE) ps

test: setup ## Executa os testes unitários em um container
	@$(COMPOSE) run --rm --build tools pnpm test

lint: setup ## Verifica o lint em um container, sem alterar arquivos
	@$(COMPOSE) run --rm --build tools pnpm lint:check

type-check: setup ## Verifica os tipos em um container
	@$(COMPOSE) run --rm --build tools pnpm type-check

verify: lint type-check test ## Executa lint, tipos e testes

migrate: check ## Executa as migrations pendentes
	@$(COMPOSE) run --rm api node apps/api/dist/scripts/run-migrations.js

shell-api: check ## Abre um shell no container da API
	@$(COMPOSE) exec api /bin/sh

shell-db: check ## Abre o console PostgreSQL
	@$(COMPOSE) exec db /bin/sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

clean: down ## Remove containers e imagens construídas pelo Compose
	@$(COMPOSE) down --rmi local --remove-orphans

destroy: setup ## Remove containers, imagens e dados do PostgreSQL (CONFIRM=1)
	@if [ "$(CONFIRM)" != "1" ]; then \
		printf 'Operação cancelada. Use make destroy CONFIRM=1 para apagar os dados.\n'; \
		exit 1; \
	fi
	@$(COMPOSE) down --volumes --rmi local --remove-orphans
