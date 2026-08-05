import { describe, expect, it } from 'vitest'
import { buildAimaStageNotification } from './aima-notification'

describe('notificações de etapas AIMA', () => {
  it('inclui o rastreio quando o cartão é enviado', () => {
    expect(
      buildAimaStageNotification('Em análise', 'Cartão Enviado', 'RU759404684PT'),
    ).toEqual({
      title: 'Etapa do processo AIMA atualizada',
      body: 'O processo AIMA passou de Em análise para Cartão Enviado. Rastreio CTT: RU759404684PT.',
      metadata: {
        previousStage: 'Em análise',
        currentStage: 'Cartão Enviado',
        cardTrackingCode: 'RU759404684PT',
      },
    })
  })

  it('não inventa rastreio para as demais etapas', () => {
    const notification = buildAimaStageNotification('Submetido', 'Em análise', null)
    expect(notification.body).toBe('O processo AIMA passou de Submetido para Em análise.')
    expect(notification.metadata.cardTrackingCode).toBeNull()
  })
})
