export type DossierStatus = 'NEGADO' | 'EM_CURSO' | 'CONCLUIDO' | 'A_CONSULTAR' | string

export interface DossierSectionEntry {
  label: string
  value: string
}

export interface DossierSection {
  title: string
  entries: DossierSectionEntry[]
}

function normalizeStatus(status: unknown): DossierStatus {
  if (typeof status === 'string') return status.toUpperCase()
  return 'EM_CURSO'
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(trimmed)) {
      try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(trimmed))
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  return JSON.stringify(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildEntriesFromObject(source: Record<string, unknown>, labels: Record<string, string>): DossierSectionEntry[] {
  return Object.entries(source)
    .filter(([key]) => !['id', 'metadados', 'metadata', 'dados_tecnicos', 'dadosTecnicos'].includes(key))
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: labels[key] || key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
      value: formatValue(value),
    }))
}

export function buildDossierSummary(input: { status: DossierStatus; denialReason?: string | null; niss?: string | null }): string {
  const normalizedStatus = normalizeStatus(input.status)

  if (normalizedStatus === 'NEGADO') {
    return 'O pedido de NISS foi negado até o momento. O processo não avançou para a concessão do benefício e a decisão deve ser analisada com atenção para verificar a necessidade de revisão ou novo encaminhamento.'
  }

  if (normalizedStatus === 'CONCLUIDO' || normalizedStatus === 'APROVADO') {
    return 'O pedido de NISS foi aprovado até o momento. O processo já apresentou resultado favorável e a concessão do benefício pode ser acompanhada com tranquilidade para fins de comunicação ao cliente.'
  }

  return 'O pedido de NISS segue em análise. O processo ainda não recebeu decisão definitiva, mas já está sendo acompanhado e pode evoluir com novas atualizações.'
}

export function buildDossierSections(dossier: Record<string, unknown>): DossierSection[] {
  const solicitacao = isPlainObject(dossier.solicitacao) ? dossier.solicitacao : {}
  const processo = isPlainObject(dossier.processo) ? dossier.processo : {}
  const cidadao = isPlainObject(dossier.cidadao) ? dossier.cidadao : {}
  const documentos = Array.isArray(dossier.documentos)
    ? dossier.documentos
    : Array.isArray(dossier.documents)
      ? dossier.documents
      : []
  const historico = Array.isArray(dossier.historico_consultas)
    ? dossier.historico_consultas
    : Array.isArray(dossier.historicoConsultas)
      ? dossier.historicoConsultas
      : []

  const status = normalizeStatus(solicitacao.status_operacional_nome || processo.estado_pedido || 'EM_CURSO')

  const summarySection: DossierSection = {
    title: 'Resumo do processo',
    entries: [
      { label: 'Resumo', value: buildDossierSummary({ status, denialReason: solicitacao.motivo_negacao as string | null | undefined }) },
    ],
  }

  const mainSection: DossierSection = {
    title: 'Informações principais',
    entries: [
      ...buildEntriesFromObject(
        {
          status: status === 'A_CONSULTAR' ? 'Em espera' : status === 'EM_CURSO' ? 'Em curso' : status === 'NEGADO' ? 'Negado' : 'Concluído',
          pedido: solicitacao.id_pedido_niss || solicitacao.id_pedido || solicitacao.request_number,
          email: solicitacao.email,
          data_nascimento: solicitacao.data_nascimento,
          niss: processo.niss_ee,
          motivo: solicitacao.motivo_negacao || processo.motivo_estado_pedido,
        },
        {
          status: 'Status',
          pedido: 'Pedido',
          email: 'Email',
          data_nascimento: 'Data de nascimento',
          niss: 'NISS',
          motivo: 'Observações',
        },
      ),
    ],
  }

  const citizenSection: DossierSection = {
    title: 'Dados do cliente',
    entries: buildEntriesFromObject(
      {
        nome: cidadao.nome || cidadao.nome_completo || cidadao.full_name,
        sobrenome: cidadao.sobrenome || cidadao.surname,
        documento: cidadao.documento || cidadao.cpf || cidadao.nif,
      },
      {
        nome: 'Nome',
        sobrenome: 'Sobrenome',
        documento: 'Documento',
      },
    ),
  }

  const documentsSection: DossierSection = {
    title: 'Documentos',
    entries: documentos.map((document, index) => ({
      label: `Documento ${index + 1}`,
      value: formatValue((document as Record<string, unknown>).nome_ficheiro || (document as Record<string, unknown>).fileName || (document as Record<string, unknown>).id || `Documento ${index + 1}`),
    })),
  }

  const historySection: DossierSection = {
    title: 'Histórico',
    entries: historico.map((entry, index) => ({
      label: `Atualização ${index + 1}`,
      value: formatValue((entry as Record<string, unknown>).iniciado_em || (entry as Record<string, unknown>).data || (entry as Record<string, unknown>).criado_em || (entry as Record<string, unknown>).timestamp) || '—',
    })),
  }

  return [summarySection, mainSection, citizenSection, documentsSection, historySection].filter(
    (section) => section.entries.length > 0,
  )
}
