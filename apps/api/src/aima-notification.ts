export type AimaStageNotification = {
  title: string
  body: string
  metadata: {
    previousStage: string
    currentStage: string
    cardTrackingCode: string | null
  }
}

export function buildAimaStageNotification(
  previousStage: string,
  currentStage: string,
  cardTrackingCode: string | null,
): AimaStageNotification {
  return {
    title: 'Etapa do processo AIMA atualizada',
    body: `O processo AIMA passou de ${previousStage} para ${currentStage}.${cardTrackingCode ? ` Rastreio CTT: ${cardTrackingCode}.` : ''}`,
    metadata: { previousStage, currentStage, cardTrackingCode },
  }
}
