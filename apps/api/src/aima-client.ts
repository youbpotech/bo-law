export type AimaProcess = {
  id: string
  clientId: string
  trackingUrl: string
  processNumber: string | null
  titleNumber: string | null
  hashProcess: string | null
  operationalStatus: number
  operationalStatusName: 'A_CONSULTAR' | 'EM_CURSO' | 'BLOQUEADA' | 'CONCLUIDA'
  attempts: number
  nextConsultationAt: string | null
  processingStartedAt: string | null
  lastAttemptAt: string | null
  denialReason: string | null
  currentState: string | null
  currentGuidance: string | null
  requestInformationDate: string | null
  executionStatus: string | null
  lastPortalConsultationAt: string | null
  createdAt: string
  updatedAt: string
}

type BotAimaRow = Record<string, unknown>

function configuration() {
  const baseUrl = (process.env.BOTAIMA_API_URL || '').replace(/\/$/, '')
  const apiKey = process.env.BOTAIMA_API_KEY || ''
  if (!baseUrl || !apiKey) {
    throw new Error('Integração BotAIMA não configurada. Defina BOTAIMA_API_URL e BOTAIMA_API_KEY.')
  }
  return { baseUrl, apiKey }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = configuration()
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new Error('Não foi possível conectar à API do BotAIMA.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      erro?: string
      detalhes?: string[]
    } | null
    throw new Error(
      body?.detalhes?.join(' ') || body?.erro || `BotAIMA recusou a operação (${response.status}).`,
    )
  }
  return response.json() as Promise<T>
}

export type AimaDocument = {
  id: string
  fileName: string
  mimeType: string | null
  documentType: string | null
  documentTypeDescription: string | null
  documentDate: string | null
}

export type AimaDocumentDownload = {
  data: Buffer
  fileName: string
  mimeType: string
}

export function fileNameFromContentDisposition(value: string | null): string | null {
  if (!value) return null
  const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      // Continua para o filename simples quando o valor estendido é inválido.
    }
  }
  return (
    value.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ??
    value.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ??
    null
  )
}

export async function getAimaProcess(id: string): Promise<AimaProcess> {
  return mapAimaProcess(await request<BotAimaRow>(`/api/v1/processos/${encodeURIComponent(id)}`))
}

export async function getAimaDossier(id: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/processos/${encodeURIComponent(id)}/dossie`)
}

export async function getAimaDocuments(id: string): Promise<AimaDocument[]> {
  const result = await request<{ dados: BotAimaRow[] }>(
    `/api/v1/processos/${encodeURIComponent(id)}/documentos`,
  )
  return result.dados.map((document) => ({
    id: text(document.id),
    fileName: text(document.nome_ficheiro) || `documento-${text(document.id)}`,
    mimeType: nullableText(document.mime_type),
    documentType: nullableText(document.tipo_documento),
    documentTypeDescription: nullableText(document.tipo_documento_descricao),
    documentDate: nullableText(document.data_documento),
  }))
}

export async function downloadAimaDocument(
  id: string,
  fileName: string,
): Promise<AimaDocumentDownload> {
  const { baseUrl, apiKey } = configuration()
  let response: Response
  try {
    response = await fetch(
      `${baseUrl}/api/v1/processos/${encodeURIComponent(id)}/documentos/${encodeURIComponent(fileName)}`,
      {
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    )
  } catch {
    throw new Error('Não foi possível baixar um documento do BotAIMA.')
  }
  if (!response.ok) throw new Error(`Não foi possível baixar o documento (${response.status}).`)
  return {
    data: Buffer.from(await response.arrayBuffer()),
    fileName: fileNameFromContentDisposition(response.headers.get('content-disposition')) || fileName,
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function listAimaProcesses(): Promise<AimaProcess[]> {
  const rows: BotAimaRow[] = []
  for (let offset = 0; offset < 10_000; offset += 100) {
    const page = await request<{ dados: BotAimaRow[] }>(
      `/api/v1/processos?limite=100&offset=${offset}`,
    )
    rows.push(...page.dados)
    if (page.dados.length < 100) break
  }
  return rows.map(mapAimaProcess)
}

export async function createAimaProcess(input: {
  companyId: number
  clientId: string
  trackingUrl: string
}): Promise<AimaProcess> {
  const row = await request<BotAimaRow>('/api/v1/processos', {
    method: 'POST',
    body: JSON.stringify({
      id_referencia_origem: input.clientId,
      url_processo_ar: input.trackingUrl,
      metadados: { origem: 'bo-law', empresa_id: input.companyId, cliente_id: input.clientId },
    }),
  })
  return mapAimaProcess(row)
}

export async function reprocessAimaProcess(id: string): Promise<AimaProcess> {
  return mapAimaProcess(
    await request<BotAimaRow>(`/api/v1/processos/${encodeURIComponent(id)}/reprocessar`, {
      method: 'POST',
    }),
  )
}

export function mapAimaProcess(row: BotAimaRow): AimaProcess {
  return {
    id: text(row.id_solicitacao),
    clientId: text(row.id_referencia_origem),
    trackingUrl: text(row.url_processo_ar),
    processNumber: nullableText(row.numero_processo),
    titleNumber: nullableText(row.numero_titulo),
    hashProcess: nullableText(row.hash_processo),
    operationalStatus: Number(row.status_operacional),
    operationalStatusName: (nullableText(row.status_operacional_nome) || 'A_CONSULTAR') as AimaProcess['operationalStatusName'],
    attempts: Number(row.quantidade_tentativas || 0),
    nextConsultationAt: nullableText(row.consultar_apos),
    processingStartedAt: nullableText(row.processamento_iniciado_em),
    lastAttemptAt: nullableText(row.ultima_tentativa_em),
    denialReason: nullableText(row.motivo_bloqueio),
    currentState: nullableText(row.estado_atual),
    currentGuidance: nullableText(row.orientacao_atual),
    requestInformationDate: nullableText(row.data_pedido_informacao),
    executionStatus: nullableText(row.status_execucao),
    lastPortalConsultationAt: nullableText(row.ultima_consulta_em),
    createdAt: text(row.criado_em),
    updatedAt: text(row.atualizado_em),
  }
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function nullableText(value: unknown): string | null {
  const result = text(value)
  return result || null
}
