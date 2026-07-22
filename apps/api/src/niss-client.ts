export type NissProcess = {
  id: string
  clientId: string
  requestNumber: string
  email: string
  birthDate: string
  operationalStatus: number
  operationalStatusName: string
  attempts: number
  nextConsultationAt: string | null
  processingStartedAt: string | null
  lastAttemptAt: string | null
  denialReason: string | null
  portalStatus: string | null
  niss: string | null
  nissCommunicated: boolean | null
  lastPortalConsultationAt: string | null
  createdAt: string
  updatedAt: string
}

type BotNissRow = Record<string, unknown>

function configuration() {
  const baseUrl = (process.env.BOTNISS_API_URL || '').replace(/\/$/, '')
  const apiKey = process.env.BOTNISS_API_KEY || ''
  if (!baseUrl || !apiKey) {
    throw new Error('Integração BotNiss não configurada. Defina BOTNISS_API_URL e BOTNISS_API_KEY.')
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
    throw new Error('Não foi possível conectar à API do BotNiss.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { erro?: string; detalhes?: string[] }
      | null
    throw new Error(body?.detalhes?.join(' ') || body?.erro || `BotNiss recusou a operação (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export async function getNissProcess(id: string): Promise<NissProcess> {
  return mapNissProcess(await request<BotNissRow>(`/api/v1/processos/${encodeURIComponent(id)}`))
}

export async function getNissDossier(id: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/processos/${encodeURIComponent(id)}/dossie`)
}

export type NissDocument = {
  id: string
  fileName: string
  mimeType: string | null
  accessUrl: string | null
}

export async function getNissDocuments(id: string): Promise<NissDocument[]> {
  const result = await request<{ dados: BotNissRow[] }>(
    `/api/v1/processos/${encodeURIComponent(id)}/documentos`,
  )
  return result.dados.map((document) => ({
    id: text(document.id),
    fileName: text(document.nome_ficheiro) || `documento-${text(document.id)}`,
    mimeType: nullableText(document.mime_type),
    accessUrl: nullableText(document.url_acesso),
  }))
}

export async function downloadNissDocument(url: string): Promise<Buffer> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new Error('Não foi possível baixar um dos documentos do BotNiss.')
  }
  if (!response.ok) throw new Error(`Não foi possível baixar um dos documentos (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function nullableText(value: unknown): string | null {
  const result = text(value)
  return result || null
}

export function mapNissProcess(row: BotNissRow): NissProcess {
  return {
    id: text(row.id_solicitacao),
    clientId: text(row.id_referencia_origem),
    requestNumber: text(row.id_pedido_niss),
    email: text(row.email),
    birthDate: text(row.data_nascimento).slice(0, 10),
    operationalStatus: Number(row.status_operacional),
    operationalStatusName: text(row.status_operacional_nome),
    attempts: Number(row.quantidade_tentativas || 0),
    nextConsultationAt: nullableText(row.consultar_apos),
    processingStartedAt: nullableText(row.processamento_iniciado_em),
    lastAttemptAt: nullableText(row.ultima_tentativa_em),
    denialReason: nullableText(row.motivo_negacao),
    portalStatus: nullableText(row.estado_pedido),
    niss: nullableText(row.niss_ee),
    nissCommunicated:
      row.niss_comunicado === null || row.niss_comunicado === undefined
        ? null
        : Boolean(row.niss_comunicado),
    lastPortalConsultationAt: nullableText(row.ultima_consulta_em),
    createdAt: text(row.criado_em),
    updatedAt: text(row.atualizado_em),
  }
}

export async function listNissProcesses(): Promise<NissProcess[]> {
  const rows: BotNissRow[] = []
  for (let offset = 0; offset < 10_000; offset += 100) {
    const page = await request<{ dados: BotNissRow[] }>(`/api/v1/processos?limite=100&offset=${offset}`)
    rows.push(...page.dados)
    if (page.dados.length < 100) break
  }
  return rows.map(mapNissProcess)
}

export async function createNissProcess(input: {
  companyId: number
  clientId: string
  requestNumber: string
  email: string
  birthDate: string
}): Promise<NissProcess> {
  const row = await request<BotNissRow>('/api/v1/processos', {
    method: 'POST',
    body: JSON.stringify({
      id_referencia_origem: input.clientId,
      id_pedido_niss: input.requestNumber,
      email: input.email,
      data_nascimento: input.birthDate,
      metadados: { origem: 'bo-law', empresa_id: input.companyId, cliente_id: input.clientId },
    }),
  })
  return mapNissProcess(row)
}
