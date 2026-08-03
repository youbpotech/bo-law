export type AimaDossierEntry = {
  label: string
  value: string
}

export type AimaDossierSection = {
  title: string
  entries: AimaDossierEntry[]
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function date(value: unknown): string {
  if (!value) return '-'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime())
    ? text(value)
    : new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

export function buildAimaDossierTitle(dossier: Record<string, unknown>): string {
  const process = objectValue(dossier.processo)
  const solicitation = objectValue(dossier.solicitacao)
  const number = process.numero_processo || solicitation.id_solicitacao
  return number ? `Processo AIMA ${String(number)}` : 'Processo AIMA'
}

export function buildAimaDossierSections(dossier: Record<string, unknown>): AimaDossierSection[] {
  const process = objectValue(dossier.processo)
  const solicitation = objectValue(dossier.solicitacao)
  const etapaList = Array.isArray(dossier.etapas) ? dossier.etapas : []
  const documentList = Array.isArray(dossier.documentos) ? dossier.documentos : []
  const historyList = Array.isArray(dossier.historico_consultas) ? dossier.historico_consultas : []

  const sections: AimaDossierSection[] = [
    {
      title: 'Resumo do acompanhamento',
      entries: [
        { label: 'Estado AIMA', value: text(process.estado_atual) },
        { label: 'Orientação atual', value: text(process.orientacao_atual) },
        { label: 'Número do processo', value: text(process.numero_processo) },
        { label: 'Número do título', value: text(process.numero_titulo) },
        { label: 'Data do pedido de informação', value: text(process.data_pedido_informacao) },
        { label: 'Última consulta ao portal', value: date(process.ultima_consulta_em) },
      ],
    },
    {
      title: 'Solicitação operacional',
      entries: [
        { label: 'ID da solicitação', value: text(solicitation.id_solicitacao) },
        { label: 'URL de acompanhamento', value: text(solicitation.url_processo_ar) },
        { label: 'Status da fila', value: text(solicitation.status_operacional_nome || solicitation.status_operacional) },
        { label: 'Tentativas', value: text(solicitation.quantidade_tentativas) },
        { label: 'Próxima consulta', value: date(solicitation.consultar_apos) },
        { label: 'Motivo de bloqueio', value: text(solicitation.motivo_bloqueio) },
      ],
    },
  ]

  if (etapaList.length) {
    sections.push({
      title: 'Etapas do processo',
      entries: etapaList.map((item, index) => {
        const etapa = objectValue(item)
        const atual = etapa.atual ? ' (atual)' : ''
        return {
          label: `${index + 1}. ${text(etapa.estado)}${atual}`,
          value: [etapa.data_evento, etapa.descricao, etapa.rastreio_ctt]
            .filter(Boolean)
            .map((value) => text(value))
            .join('\n') || '-',
        }
      }),
    })
  }

  sections.push({
    title: 'Registos técnicos',
    entries: [
      { label: 'Documentos disponíveis', value: String(documentList.length) },
      { label: 'Consultas registadas', value: String(historyList.length) },
    ],
  })
  return sections
}
