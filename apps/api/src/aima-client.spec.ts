import { describe, expect, it } from 'vitest'
import {
  fileNameFromContentDisposition,
  isAimaCardSentState,
  mapAimaProcess,
  shouldFetchAimaCardTracking,
} from './aima-client'

describe('cliente BotAIMA', () => {
  it('mapeia o contrato snake_case da API para o modelo do backoffice', () => {
    const process = mapAimaProcess({
      id_solicitacao: '7',
      id_referencia_origem: 'legal-case-id',
      url_processo_ar: 'https://contactenos.aima.gov.pt/tracking/uuid',
      numero_processo: 'AR-7',
      numero_titulo: null,
      hash_processo: 'uuid',
      status_operacional: 1,
      status_operacional_nome: 'EM_CURSO',
      quantidade_tentativas: 2,
      estado_atual: 'Em análise',
      orientacao_atual: 'Aguardar',
      status_execucao: 'SUCESSO',
      criado_em: '2026-08-03T10:00:00.000Z',
      atualizado_em: '2026-08-03T11:00:00.000Z',
    })

    expect(process).toMatchObject({
      id: '7',
      sourceReference: 'legal-case-id',
      processNumber: 'AR-7',
      operationalStatus: 1,
      currentState: 'Em análise',
      attempts: 2,
      executionStatus: 'SUCESSO',
      cardTrackingCode: null,
    })
  })

  it('prioriza o nome físico entregue pelo Content-Disposition', () => {
    expect(fileNameFromContentDisposition("attachment; filename*=UTF-8''snapshot%20a.html")).toBe('snapshot a.html')
    expect(fileNameFromContentDisposition('attachment; filename="snapshot.html"')).toBe('snapshot.html')
  })

  it('consulta o rastreio quando o cartão foi enviado ou já foi entregue', () => {
    expect(shouldFetchAimaCardTracking('Cartão Enviado')).toBe(true)
    expect(shouldFetchAimaCardTracking('Cartao enviado')).toBe(true)
    expect(shouldFetchAimaCardTracking('Cartão entregue')).toBe(true)
    expect(shouldFetchAimaCardTracking('Em análise')).toBe(false)
    expect(isAimaCardSentState('Cartão Enviado')).toBe(true)
    expect(isAimaCardSentState('Cartão entregue')).toBe(false)
  })
})
