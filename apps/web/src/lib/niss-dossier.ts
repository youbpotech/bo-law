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

function resolveCitizenNiss(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return null
  return formatValue(value) === '—' ? null : formatValue(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return String(value).trim()
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

export function buildDossierTitle(dossier: Record<string, unknown>): string {
  const cidadao = isPlainObject(dossier.cidadao) ? dossier.cidadao : {}
  const firstName = normalizeText(cidadao.nome || cidadao.nome_completo || cidadao.full_name)
  const lastName = normalizeText(cidadao.sobrenome || cidadao.surname)

  if (firstName || lastName) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    return `Pedido de ${fullName}`
  }

  const solicitacao = isPlainObject(dossier.solicitacao) ? dossier.solicitacao : {}
  const processId = solicitacao.id_solicitacao || solicitacao.id || solicitacao.request_number
  return processId ? `Pedido ${String(processId)}` : 'Pedido'
}

export function buildDossierSummary(input: {
  status: DossierStatus
  clientName?: string | null
  decisionDate?: string | null
  denialReason?: string | null
  niss?: string | null
}): string {
  const normalizedStatus = normalizeStatus(input.status)
  const clientName = input.clientName?.trim() || 'o cliente'
  const decisionDate = input.decisionDate ? formatValue(input.decisionDate) : 'na data da decisão'
  const reason = input.denialReason?.trim() || 'motivo não informado'
  const niss = resolveCitizenNiss(input.niss)

  if (normalizedStatus === 'NEGADO') {
    return `O pedido de NISS de ${clientName} foi reprovado em ${decisionDate}, com indicação de ${reason}. O procedimento não avançou para a concessão do benefício, razão pela qual a decisão requer análise cuidadosa quanto à necessidade de revisão ou de novo encaminhamento.`
  }

  if (normalizedStatus === 'CONCLUIDO' || normalizedStatus === 'APROVADO') {
    const nissText = niss ? ` O número NISS associado é ${niss}.` : ''
    return `O pedido de NISS de ${clientName} foi aprovado em ${decisionDate}. O processo apresentou resultado favorável${nissText} A evolução do procedimento poderá ser acompanhada com vistas à comunicação formal ao cliente.`
  }

  return `O pedido de NISS de ${clientName} segue em análise. O procedimento ainda não recebeu decisão definitiva, mas encontra-se sob acompanhamento, podendo evoluir com novas atualizações.`
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
      {
        label: 'Resumo',
        value: buildDossierSummary({
          status,
          clientName: (cidadao.nome || cidadao.nome_completo || cidadao.full_name) as string | null | undefined,
          decisionDate: processo.data_estado_pedido || processo.data_estado_pedido_epoch_ms || solicitacao.atualizado_em,
          denialReason: solicitacao.motivo_negacao as string | null | undefined,
          niss: processo.niss_comunicado as string | null | undefined,
        }),
      },
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
          niss: processo.niss_comunicado,
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
