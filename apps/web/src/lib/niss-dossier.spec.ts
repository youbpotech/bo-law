import { describe, expect, it } from 'vitest'
import { buildDossierSummary, buildDossierSections } from './niss-dossier'

describe('buildDossierSummary', () => {
  it('retorna um texto de resumo para pedidos negados', () => {
    const summary = buildDossierSummary({
      status: 'NEGADO',
      clientName: 'Maria Silva',
      decisionDate: '2026-07-22',
      denialReason: 'Documento incompleto',
    })

    expect(summary).toContain('Maria Silva')
    expect(summary).toContain('reprovado')
    expect(summary).toContain('Documento incompleto')
  })

  it('retorna um texto de resumo para pedidos em curso', () => {
    const summary = buildDossierSummary({ status: 'EM_CURSO', clientName: 'Maria Silva' })

    expect(summary).toContain('Maria Silva')
    expect(summary).toContain('segue em análise')
  })

  it('retorna um texto de resumo para pedidos aprovados', () => {
    const summary = buildDossierSummary({ status: 'CONCLUIDO', clientName: 'Maria Silva', niss: '12345678901' })

    expect(summary).toContain('Maria Silva')
    expect(summary).toContain('aprovado')
    expect(summary).toContain('resultado favorável')
  })
})

describe('buildDossierSections', () => {
  it('filtra campos técnicos e mantém apenas as informações relevantes', () => {
    const sections = buildDossierSections({
      solicitacao: {
        email: 'cliente@example.com',
        data_nascimento: '1990-01-01',
        status_operacional_nome: 'NEGADO',
        motivo_negacao: 'Documento incompleto',
        metadados: { interno: true },
        id_solicitacao: 12,
      },
      processo: {
        estado_pedido: 'NEGADO',
        niss_ee: '12345678901',
        ultima_consulta_em: '2026-07-22T10:00:00Z',
      },
      cidadao: {
        nome: 'Maria Silva',
        sobrenome: 'Souza',
      },
      documentos: [{ nome_ficheiro: 'rg.pdf' }],
      historico_consultas: [{ iniciado_em: '2026-07-22T10:00:00Z', resultado: 'ok' }],
    })

    expect(sections.some((section) => section.title === 'Resumo do processo')).toBe(true)
    expect(sections.some((section) => section.title === 'Informações principais')).toBe(true)
    expect(sections.some((section) => section.title === 'Documentos')).toBe(true)

    const detailsSection = sections.find((section) => section.title === 'Informações principais')
    expect(detailsSection?.entries.some((entry) => entry.label === 'Status')).toBe(true)
    expect(detailsSection?.entries.some((entry) => entry.label === 'Metadados')).toBe(false)
    expect(detailsSection?.entries.some((entry) => entry.label === 'ID da solicitação')).toBe(false)
  })
})
