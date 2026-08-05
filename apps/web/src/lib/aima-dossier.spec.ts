import { describe, expect, it } from 'vitest'
import { buildAimaDossierSections, buildAimaDossierTitle } from './aima-dossier'

describe('dossiê AIMA', () => {
  it('monta o título e as secções a partir do contrato do BotAIMA', () => {
    const dossier = {
      solicitacao: { id_solicitacao: '12', status_operacional_nome: 'EM_CURSO' },
      processo: {
        numero_processo: 'AR-123',
        estado_atual: 'Em análise',
        orientacao_atual: 'Aguardar decisão',
      },
      etapas: [{ estado: 'Pedido recebido', atual: true, descricao: 'Registado' }],
      documentos: [{ id: '1' }],
      historico_consultas: [{ id: '1' }],
    }

    expect(buildAimaDossierTitle(dossier)).toBe('Processo AIMA AR-123')
    const sections = buildAimaDossierSections(dossier)
    expect(sections.some((section) => section.title === 'Etapas do processo')).toBe(true)
    expect(sections.find((section) => section.title === 'Resumo do acompanhamento')?.entries).toContainEqual({
      label: 'Estado AIMA',
      value: 'Em análise',
    })
  })
})
