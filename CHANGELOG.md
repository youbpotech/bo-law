# Changelog

Este arquivo registra as mudanças relevantes do Backoffice Jurídico.

## [Não publicado]

### Processos e notificações

- Unificados processos gerais, NISS e AIMA no agregado canónico `LegalCase`, sempre
  associado a uma empresa e a um cliente.
- Adicionado o vínculo técnico `LegalCaseIntegration`, com reserva idempotente para
  impedir duplicação de pedidos externos, validação imediata da referência devolvida e
  sincronização monotónica dos estados retornados.
- Adicionados stakeholders de processo, mantendo o criador obrigatório e permitindo
  selecionar outros utilizadores da mesma empresa em todas as criações; a coluna do
  criador também passa a ser obrigatória no banco.
- Adicionadas preferências de canais por utilizador, com notificação interna por padrão e
  validação da disponibilidade no momento de cada evento, recorrendo ao alerta interno
  quando todos os canais externos preferidos estiverem indisponíveis.
- Incluído SMS no catálogo suportado e na persistência, visível de forma esmaecida e
  bloqueado para seleção ou entrega enquanto o adapter não estiver implementado.
- Ajustado o contrato de origem de BotNiss e BotAIMA para receber diretamente o UUID do
  `LegalCase`, mantendo o identificador do cliente apenas nos metadados.
- Processos NISS negados permanecem ativos em diligências para análise, em vez de serem
  encerrados como processos concluídos.
- A edição de processos passa a atualizar os stakeholders adicionais, sem remover o
  criador, e a listagem passa a expor o nome completo do cliente.
- Adicionado acesso unificado aos documentos pelo processo e um atalho na listagem de
  utilizadores para filtrar os documentos dos seus processos.
- NISS passa a permitir reconsulta, usando o mesmo botão de refresh do AIMA.

### Utilizadores

- A abertura do modal de edição recupera as roles atuais do Keycloak antes de preencher
  os controlos do formulário.

### Operação

- Configurada a imagem `postgres:18-alpine` como banco inicial do projeto.
- Adotado o layout nativo do PostgreSQL 18, com o volume `postgres_data` montado em
  `/var/lib/postgresql`.

## [v0.1] - 2026-07-21

Primeiro seed funcional do backoffice multiempresa para escritórios de advocacia,
derivado da estrutura administrativa existente e simplificado para representar a
captação, a execução do serviço jurídico e a faturação inicial.

### Núcleo administrativo

- Mantidos os cadastros de empresas, usuários e clientes.
- Implementado isolamento de dados por empresa nas rotas e consultas do sistema.
- Adicionada seleção de empresa ao contexto autenticado do usuário root, sem alterar
  permanentemente a empresa associada ao cadastro do usuário.
- Restringidas as operações de criação, edição e exclusão de usuários ao perfil root.
- Impedida a exclusão de usuários root, da empresa atualmente selecionada e da empresa
  padrão da instalação.
- Normalizados os nomes de usuário em letras minúsculas, com unicidade sem distinção
  entre maiúsculas e minúsculas.

### Dashboard

- Mantida a estrutura do dashboard original.
- Adicionada configuração de widgets por empresa.
- Disponibilizados indicadores de captação, entrevistas, processos, documentos,
  faturação e reidratações.
- Restringida a configuração a uma lista conhecida de widgets, sem aceitar HTML,
  componentes ou URLs arbitrárias.

### Esteira jurídica

- Criada a entidade simplificada `LegalCase` para representar o processo de prestação
  do serviço jurídico.
- Implementadas as etapas de pagamento inicial, coleta documental, agendamentos,
  diligências, produção de artefatos, entrega ao cliente, pagamento final e encerramento.
- Implementado o retorno para coleta quando a documentação estiver incompleta.
- Bloqueadas transições inválidas e regressões documentais após o início das etapas
  finais do processo.
- Criada a entidade `Invoice`, limitada a uma faturação parcial de 30% e uma final de
  70% por processo.
- Garantido que o rateio em centavos das duas faturas corresponda exatamente ao valor
  total contratado.
- Automatizado o início da execução após o pagamento parcial e o encerramento após o
  pagamento final.

### Captação e leads

- Mantido o módulo de leads como cadastro inicial de contatos com potencial interesse
  em serviços jurídicos.
- Adaptados os campos de qualificação para área jurídica, serviço pretendido, resumo do
  caso, jurisdição, urgência, prazo, honorários, capacidade de pagamento e documentos.
- Implementados entrevista, reidratação em 30 dias e conversão transacional do contato
  em cliente e processo jurídico.
- Mantida a integração opcional com WhatsApp, OpenAI e transcrição de áudio.
- Deliberadamente adiado o refinamento profundo da automação de leads para uma versão
  posterior.

### Interface

- Atualizadas a identidade visual, a navegação e os textos para o contexto jurídico.
- Criadas telas para processos, etapas de execução, documentação e faturação.
- Adaptada a tela de leads para qualificação jurídica e conversão em processo.
- Removidas da interface as rotas e telas de imóveis, dossiês públicos e recomendações.
- Adicionado suporte à seleção de um cliente existente durante a conversão de lead.
- Limpo o cache da aplicação ao autenticar, sair ou trocar de empresa.

### Removido

- Entidades, serviços, APIs e componentes exclusivos do domínio imobiliário.
- Cadastro e consulta de imóveis.
- Dossiês imobiliários e dossiês públicos.
- Recomendações de imóveis.
- Estruturas geográficas utilizadas exclusivamente pelo catálogo imobiliário.
- Tokens e rotas da API imobiliária do backoffice.
- Credenciais administrativas conhecidas ou embutidas no código.

### Migração de dados

- Criada uma migration consolidada para iniciar o domínio jurídico em uma base nova ou
  adaptar a base administrativa anterior.
- Preservados empresas, usuários, clientes, leads, mensagens e áudios existentes.
- Removidas apenas as tabelas internas específicas do antigo backoffice imobiliário.
- Mantido intacto o catálogo imobiliário externo, que pode ser compartilhado com outro
  serviço.
- Não convertidos orçamento, score ou engajamento imobiliário em honorários ou
  qualificação jurídica.
- Adicionada proteção contra a atribuição automática de registros globais a uma empresa
  arbitrária em instalações multiempresa.
- Definida a migration como irreversível; o retorno à estrutura anterior exige backup.

### Segurança e operação

- Tornado obrigatório em produção um `AUTH_SECRET` com pelo menos 32 caracteres.
- Criado bootstrap idempotente do primeiro usuário root por variáveis de ambiente, sem
  senha padrão.
- Ativada por padrão a validação da assinatura dos webhooks da Twilio.
- Isolado o remetente de WhatsApp por empresa, com fallback global apenas quando
  explicitamente configurado.
- Removida a simulação silenciosa de envio da Twilio em produção.
- Atualizados Docker Compose, Makefile, exemplos de ambiente e documentação operacional
  para o projeto `bo-law`.
- Tornado o pgAdmin opcional, restrito ao endereço local e sem credenciais conhecidas.

### Documentação

- Reescrito o `README.md` com instalação, bootstrap, integrações e comandos de
  verificação.
- Documentada em `docs/legal-workflow.md` a correspondência entre captação, execução,
  faturação e as entidades persistidas.
- Atualizada a documentação de implantação em cPanel.

### Validação da versão

- 44 testes automatizados aprovados: 36 da API e 8 da aplicação web.
- Lint, verificação de tipos e builds de produção da API e do frontend aprovados.
- Configuração do Docker Compose validada com variáveis explícitas.
- Migration executada com sucesso em uma instância PostgreSQL descartável e vazia.
- Bootstrap root validado quanto à criação inicial e à repetição idempotente.
- Fluxo HTTP validado desde a autenticação e captação até os pagamentos de 30% e 70% e
  o encerramento do processo.
- Isolamento entre empresas e restrições de acesso de usuários não-root verificados no
  smoke test integrado.

### Limitações conhecidas

- Esta versão representa o BPMN por estados das entidades e não inclui um motor BPMN
  genérico ou configurador visual de processos.
- A automação de leads ainda não inclui fila durável completa, ordenação por contato,
  retentativa abrangente de entregas e tratamento final de todos os dados legados; esse
  endurecimento fica reservado para a refatoração específica do módulo.
