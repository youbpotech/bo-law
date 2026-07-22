import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNissProcess, listNissProcesses, mapNissProcess } from './niss-client'

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.BOTNISS_API_URL
  delete process.env.BOTNISS_API_KEY
})

describe('cliente da API BotNiss', () => {
  it('adapta os campos operacionais documentados para o contrato do backoffice', () => {
    expect(mapNissProcess({
      id_solicitacao: '12', id_referencia_origem: 'cliente-1', id_pedido_niss: '106002',
      email: 'cliente@example.com', data_nascimento: '1990-12-31T00:00:00.000Z',
      status_operacional: 3, status_operacional_nome: 'CONCLUIDO', quantidade_tentativas: 2,
      niss_ee: '12345678901', niss_comunicado: true, criado_em: '2026-07-22T10:00:00Z',
      atualizado_em: '2026-07-22T11:00:00Z',
    })).toMatchObject({
      id: '12', clientId: 'cliente-1', requestNumber: '106002', birthDate: '1990-12-31',
      operationalStatusName: 'CONCLUIDO', attempts: 2, niss: '12345678901',
    })
  })

  it('envia a referência do cliente e a origem bo-law na criação', async () => {
    process.env.BOTNISS_API_URL = 'http://botniss.test'
    process.env.BOTNISS_API_KEY = 'secret'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id_solicitacao: '1', id_referencia_origem: 'client-uuid', id_pedido_niss: '106002',
      email: 'cliente@example.com', data_nascimento: '1990-12-31', status_operacional: 0,
      status_operacional_nome: 'A_CONSULTAR', quantidade_tentativas: 0,
      criado_em: '2026-07-22T10:00:00Z', atualizado_em: '2026-07-22T10:00:00Z',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await createNissProcess({ companyId: 4, clientId: 'client-uuid', requestNumber: '106002', email: 'cliente@example.com', birthDate: '1990-12-31' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://botniss.test/api/v1/processos')
    expect(JSON.parse(String(init.body))).toMatchObject({
      id_referencia_origem: 'client-uuid', metadados: { origem: 'bo-law', empresa_id: 4, cliente_id: 'client-uuid' },
    })
  })

  it('pagina a listagem conforme o limite documentado', async () => {
    process.env.BOTNISS_API_URL = 'http://botniss.test'
    process.env.BOTNISS_API_KEY = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ dados: [] }), { status: 200 })))
    await expect(listNissProcesses()).resolves.toEqual([])
  })
})
