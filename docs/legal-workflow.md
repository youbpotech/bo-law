# Esteira jurídica inicial

O BPMN de captação, execução e faturação é representado por três agregados simples. Não
há motor de workflow nem entidade genérica de tarefa nesta primeira versão.

| Lane | Entidade | Estado persistido |
| --- | --- | --- |
| Captação | `Lead` | `salesStage`, entrevista e reidratação |
| Execução | `LegalCase` | `stage` e `documentsComplete` |
| Faturação | `Invoice` | `kind`, percentual e `status` |

## Captação

Um lead pertence obrigatoriamente a uma empresa e o telefone é único somente dentro
dessa empresa. A qualificação registra canal, área jurídica, serviço pretendido, resumo
do caso, jurisdição, urgência, prazo crítico, orçamento de honorários, capacidade de
pagamento e prontidão documental.

`conversationStatus` controla quem conversa (`bot_active`, `awaiting_human` ou
`human_active`) e não é misturado com a etapa comercial:

```text
new -> interview_scheduled -> interview_completed -> contracted
                           \-> nurturing (+30 dias) -> nova abordagem
                           \-> lost
```

A conversão associa ou cria um `Client`, cria o `LegalCase` e solicita automaticamente a
fatura parcial de 30%, tudo dentro do mesmo fluxo de negócio.

## Execução e documentação

```text
awaiting_initial_payment
  -> document_collection
  -> public_services_scheduling
  -> diligences
       -> awaiting_documents -> document_collection
       -> final_artifacts
  -> client_final_delivery
  -> awaiting_final_payment
  -> closed
```

O pagamento parcial abre a coleta documental. Em `diligences`, documentação incompleta
retorna para a coleta; documentação confirmada permite produzir os artefatos finais.

## Faturação

Cada processo aceita no máximo duas faturas:

- `partial`, 30% do valor contratado;
- `final`, 70% do valor contratado.

Cada uma avança sequencialmente por `requested -> issued -> paid`. O pagamento parcial
inicia a execução e o pagamento final encerra o processo. A API rejeita saltos de estado
e transições de processo fora da esteira.

## Dashboard

`Company.dashboardConfig.widgets` mantém uma lista ordenada de chaves conhecidas. A API
valida as chaves e nunca aceita HTML, componentes ou URLs vindos da configuração.
Cada empresa pode escolher entre total de leads, leads quentes, entrevistas pendentes,
processos ativos, documentos pendentes, valores a receber, valores recebidos e
reidratações vencidas.

## Privacidade e triagem

Mensagens e transcrições podem conter informação jurídica sensível. O agente serve
apenas para triagem comercial, não conclui direitos, resultados ou prazos e encaminha
urgências e pedidos de aconselhamento para atendimento humano.
