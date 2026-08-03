import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { getActiveCompanyId, getAuthToken, setActiveCompanyId } from '@/lib/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export type DashboardWidgetKey =
  | 'totalLeads'
  | 'hotLeads'
  | 'pendingInterviews'
  | 'activeCases'
  | 'pendingDocuments'
  | 'outstandingAmount'
  | 'receivedAmount'
  | 'rehydrationsDue'

export interface DashboardConfig {
  widgets: DashboardWidgetKey[]
}

export interface Company {
  id: number
  name: string
  theme: string
  hasLogo: boolean
  logoUrl: string | null
  hasFavicon: boolean
  faviconUrl: string | null
  hasLoginBanner: boolean
  loginBannerUrl: string | null
  whatsappNumber?: string | null
  dashboardConfig: DashboardConfig
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  username: string
  email: string | null
  companyId: number
  root: boolean
  roleRoot: boolean
  permissions: ResourceKey[]
  roleIds: string[]
  company?: Company | null
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  surname?: string | null
  portugueseTaxId?: string | null
  niss?: string | null
  snsUserNumber?: string | null
  arNumber?: string | null
  citizenCardNumber?: string | null
  foreignTaxId?: string | null
  foreignTaxIdType?: string | null
  birthDate?: string | null
  sex?: string | null
  maritalStatus?: string | null
  parent1Name?: string | null
  parent1Surname?: string | null
  parent2Name?: string | null
  parent2Surname?: string | null
  nationalityCountry?: string | null
  birthCountry?: string | null
  birthProvince?: string | null
  birthProvinceCode?: string | null
  birthPlace?: string | null
  birthDistrictId?: number | null
  birthMunicipalityId?: number | null
  birthParishId?: number | null
  civilDocumentType?: string | null
  civilDocumentNumber?: string | null
  civilDocumentExpiryDate?: string | null
  email?: string | null
  mobileCountryCode?: string | null
  mobile?: string | null
  phoneCountryCode?: string | null
  phone?: string | null
  residenceCountry?: string | null
  residenceAddress?: string | null
  residenceLocality?: string | null
  residencePostalCode?: string | null
  residencePostalLocality?: string | null
  residenceDistrictId?: number | null
  residenceMunicipalityId?: number | null
  residenceParishId?: number | null
  foreignAddress?: string | null
  foreignAddress1?: string | null
  foreignAddress2?: string | null
  foreignCity?: string | null
  foreignRegion?: string | null
  foreignPostalCode?: string | null
  companyId: number
  createdAt: string
  updatedAt: string
}

export interface UserInput {
  name: string
  username: string
  email?: string
  password?: string
  roleIds: string[]
}

export type ResourceKey =
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'clients'
  | 'companies'
  | 'leads'
  | 'cases'
  | 'niss'
  | 'aima'

export interface NissProcess {
  id: string
  clientId: string
  requestNumber: string
  email: string
  birthDate: string
  operationalStatus: number
  operationalStatusName: 'A_CONSULTAR' | 'EM_CURSO' | 'NEGADO' | 'CONCLUIDO'
  attempts: number
  nextConsultationAt: string | null
  lastAttemptAt: string | null
  denialReason: string | null
  portalStatus: string | null
  niss: string | null
  nissCommunicated: boolean | null
  createdAt: string
  updatedAt: string
  client: Client
}

export interface AimaProcess {
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
  client: Client
}

export interface AimaInput {
  clientId: string
  trackingUrl: string
}

export interface AimaDocument {
  id: string
  fileName: string
  mimeType: string | null
  documentType: string | null
  documentTypeDescription: string | null
  documentDate: string | null
}

export interface NissInput {
  clientId: string
  requestNumber: string
  email: string
  birthDate: string
}

export interface NissDocument {
  id: string
  fileName: string
  mimeType: string | null
}

export interface ManagedRole {
  id: string
  name: string
  description: string | null
  isRoot: boolean
  resources: ResourceKey[]
}

export interface ResourceDefinition {
  key: ResourceKey
  name: string
  kind: 'resource' | 'process'
}

export interface RoleInput {
  name: string
  description?: string | null
  resources: ResourceKey[]
}

export type ClientInput = Pick<Client, 'name'> &
  Partial<Omit<Client, 'id' | 'name' | 'companyId' | 'createdAt' | 'updatedAt'>>

export interface CompanyInput {
  name: string
  theme: string
  logoDataUrl?: string | null
  faviconDataUrl?: string | null
  loginBannerDataUrl?: string | null
  whatsappNumber?: string | null
  dashboardConfig?: DashboardConfig
}

export async function authRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getAuthToken() ?? ''}`,
      ...(getActiveCompanyId() ? { 'X-Company-Id': String(getActiveCompanyId()) } : {}),
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Erro ao processar solicitação')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function buscarSessao(): Promise<User> {
  return authRequest<User>('/api/me')
}

interface SwitchCompanyResponse {
  user: User
}

async function alternarEmpresa(companyId: number): Promise<SwitchCompanyResponse> {
  return authRequest<SwitchCompanyResponse>('/api/me/company', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  })
}

export function useSession() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: buscarSessao,
    retry: false,
  })

  const alternarEmpresaMutation = useMutation({
    mutationFn: alternarEmpresa,
    onSuccess: async ({ user }) => {
      const tenantKeys = new Set([
        'users',
        'clients',
        'leads',
        'lead',
        'cases',
        'dashboard',
        'niss',
        'aima',
        'notifications',
      ])
      await queryClient.cancelQueries({
        predicate: (query) => tenantKeys.has(String(query.queryKey[0])),
      })
      setActiveCompanyId(user.companyId)
      queryClient.setQueryData(['session'], user)
      await queryClient.resetQueries({
        predicate: (query) => tenantKeys.has(String(query.queryKey[0])),
      })
    },
  })

  const switchCompany = async (companyId: number) =>
    (await alternarEmpresaMutation.mutateAsync(companyId)).user

  return {
    currentUser: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    error: sessionQuery.error,
    refetch: sessionQuery.refetch,
    alternarEmpresa: switchCompany,
    isSwitchingCompany: alternarEmpresaMutation.isPending,
  }
}

async function buscarEmpresas(): Promise<Company[]> {
  return authRequest<Company[]>('/api/companies')
}

async function criarEmpresa(dados: CompanyInput): Promise<Company> {
  return authRequest<Company>('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function atualizarEmpresa({
  id,
  dados,
}: {
  id: number
  dados: CompanyInput
}): Promise<Company> {
  return authRequest<Company>(`/api/companies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function excluirEmpresa(id: number): Promise<void> {
  return authRequest<void>(`/api/companies/${id}`, { method: 'DELETE' })
}

export function useCompanies(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient()
  const enabledValue = computed(() => toValue(enabled))
  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: buscarEmpresas,
    enabled: enabledValue,
  })

  const criarMutation = useMutation({
    mutationFn: criarEmpresa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })
  const atualizarMutation = useMutation({
    mutationFn: atualizarEmpresa,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
        queryClient.invalidateQueries({ queryKey: ['session'] }),
      ])
    },
  })
  const excluirMutation = useMutation({
    mutationFn: excluirEmpresa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })

  return {
    companies: computed(() => companiesQuery.data.value || []),
    isLoading: companiesQuery.isLoading,
    error: companiesQuery.error,
    refetch: companiesQuery.refetch,
    criarEmpresa: criarMutation.mutateAsync,
    atualizarEmpresa: atualizarMutation.mutateAsync,
    excluirEmpresa: excluirMutation.mutateAsync,
    isCreating: criarMutation.isPending,
    isUpdating: atualizarMutation.isPending,
    isDeleting: excluirMutation.isPending,
  }
}

async function buscarUsuarios(): Promise<User[]> {
  return authRequest<User[]>('/api/users')
}

async function criarUsuario(dados: UserInput): Promise<User> {
  return authRequest<User>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function atualizarUsuario({ id, dados }: { id: string; dados: UserInput }): Promise<User> {
  return authRequest<User>(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function excluirUsuario(id: string): Promise<void> {
  return authRequest<void>(`/api/users/${id}`, { method: 'DELETE' })
}

export function useUsers() {
  const queryClient = useQueryClient()
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: buscarUsuarios })
  const criarMutation = useMutation({
    mutationFn: criarUsuario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
  const atualizarMutation = useMutation({
    mutationFn: atualizarUsuario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
  const excluirMutation = useMutation({
    mutationFn: excluirUsuario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  return {
    users: computed(() => usersQuery.data.value || []),
    isLoading: usersQuery.isLoading,
    error: usersQuery.error,
    criarUsuario: criarMutation.mutateAsync,
    atualizarUsuario: atualizarMutation.mutateAsync,
    excluirUsuario: excluirMutation.mutateAsync,
    isCreating: criarMutation.isPending,
    isUpdating: atualizarMutation.isPending,
    isDeleting: excluirMutation.isPending,
  }
}

async function buscarRoles(): Promise<ManagedRole[]> {
  return authRequest<ManagedRole[]>('/api/roles')
}

async function buscarRecursos(): Promise<ResourceDefinition[]> {
  return authRequest<ResourceDefinition[]>('/api/resources')
}

async function criarRole(dados: RoleInput): Promise<ManagedRole> {
  return authRequest<ManagedRole>('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function atualizarRole({
  id,
  dados,
}: {
  id: string
  dados: RoleInput
}): Promise<ManagedRole> {
  return authRequest<ManagedRole>(`/api/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function excluirRole(id: string): Promise<void> {
  return authRequest<void>(`/api/roles/${id}`, { method: 'DELETE' })
}

export function useRoles(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient()
  const enabledValue = computed(() => toValue(enabled))
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: buscarRoles, enabled: enabledValue })
  const resourcesQuery = useQuery({
    queryKey: ['resources'],
    queryFn: buscarRecursos,
    enabled: enabledValue,
  })
  const createMutation = useMutation({
    mutationFn: criarRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })
  const updateMutation = useMutation({
    mutationFn: atualizarRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: excluirRole,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })
  return {
    roles: computed(() => rolesQuery.data.value || []),
    resources: computed(() => resourcesQuery.data.value || []),
    isLoading: computed(() => rolesQuery.isLoading.value || resourcesQuery.isLoading.value),
    error: computed(() => rolesQuery.error.value || resourcesQuery.error.value),
    criarRole: createMutation.mutateAsync,
    atualizarRole: updateMutation.mutateAsync,
    excluirRole: deleteMutation.mutateAsync,
    isSaving: computed(() => createMutation.isPending.value || updateMutation.isPending.value),
    isDeleting: deleteMutation.isPending,
  }
}

async function buscarClientes(): Promise<Client[]> {
  return authRequest<Client[]>('/api/clients')
}

async function criarCliente(dados: ClientInput): Promise<Client> {
  return authRequest<Client>('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function atualizarCliente({
  id,
  dados,
}: {
  id: string
  dados: ClientInput
}): Promise<Client> {
  return authRequest<Client>(`/api/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function excluirCliente(id: string): Promise<void> {
  return authRequest<void>(`/api/clients/${id}`, { method: 'DELETE' })
}

export function useClients() {
  const queryClient = useQueryClient()
  const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: buscarClientes })
  const criarMutation = useMutation({
    mutationFn: criarCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })
  const atualizarMutation = useMutation({
    mutationFn: atualizarCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })
  const excluirMutation = useMutation({
    mutationFn: excluirCliente,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  return {
    clients: computed(() => clientsQuery.data.value || []),
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
    criarCliente: criarMutation.mutateAsync,
    atualizarCliente: atualizarMutation.mutateAsync,
    excluirCliente: excluirMutation.mutateAsync,
    isCreating: criarMutation.isPending,
    isUpdating: atualizarMutation.isPending,
    isDeleting: excluirMutation.isPending,
  }
}

async function buscarNiss(): Promise<NissProcess[]> {
  return authRequest<NissProcess[]>('/api/niss')
}

async function criarNiss(dados: NissInput): Promise<NissProcess> {
  return authRequest<NissProcess>('/api/niss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function buscarDossieNiss(id: string): Promise<Record<string, unknown>> {
  return authRequest<Record<string, unknown>>(`/api/niss/${id}/dossier`)
}

async function buscarDocumentosNiss(id: string): Promise<NissDocument[]> {
  return authRequest<NissDocument[]>(`/api/niss/${id}/documents`)
}

export type NissDocumentDownload = {
  blob: Blob
  fileName: string
}

function downloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition')
  const encoded = disposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      // Continua para filename quando o valor estendido for inválido.
    }
  }
  return (
    disposition?.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ??
    disposition?.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ??
    fallback
  )
}

async function baixarDocumentoNiss({
  processId,
  fileName,
}: {
  processId: string
  fileName: string
}): Promise<NissDocumentDownload> {
  const response = await fetch(
    `${API_BASE_URL}/api/niss/${encodeURIComponent(processId)}/documents/${encodeURIComponent(fileName)}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ''}`,
        ...(getActiveCompanyId() ? { 'X-Company-Id': String(getActiveCompanyId()) } : {}),
      },
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Não foi possível baixar o documento.')
  }
  return {
    blob: await response.blob(),
    fileName: downloadFileName(response, fileName),
  }
}

async function baixarDocumentosNiss(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/niss/${id}/documents.zip`, {
    headers: {
      Authorization: `Bearer ${getAuthToken() ?? ''}`,
      ...(getActiveCompanyId() ? { 'X-Company-Id': String(getActiveCompanyId()) } : {}),
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Não foi possível baixar os documentos.')
  }
  return response.blob()
}

export function useNiss() {
  const queryClient = useQueryClient()
  const nissQuery = useQuery({ queryKey: ['niss'], queryFn: buscarNiss })
  const createMutation = useMutation({
    mutationFn: criarNiss,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['niss'] }),
  })
  const dossierMutation = useMutation({ mutationFn: buscarDossieNiss })
  const documentsMutation = useMutation({ mutationFn: baixarDocumentosNiss })
  const documentListMutation = useMutation({ mutationFn: buscarDocumentosNiss })
  const singleDocMutation = useMutation({ mutationFn: baixarDocumentoNiss })
  return {
    processes: computed(() => nissQuery.data.value || []),
    isLoading: nissQuery.isLoading,
    error: nissQuery.error,
    criarNiss: createMutation.mutateAsync,
    buscarDossie: dossierMutation.mutateAsync,
    baixarDocumentos: documentsMutation.mutateAsync,
    buscarDocumentos: documentListMutation.mutateAsync,
    baixarDocumento: singleDocMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isLoadingDossier: dossierMutation.isPending,
    isDownloadingDocuments: documentsMutation.isPending,
    isLoadingDocuments: documentListMutation.isPending,
    isDownloadingDocument: singleDocMutation.isPending,
    refresh: nissQuery.refetch,
  }
}

async function buscarAima(): Promise<AimaProcess[]> {
  return authRequest<AimaProcess[]>('/api/aima')
}

async function criarAima(dados: AimaInput): Promise<AimaProcess> {
  return authRequest<AimaProcess>('/api/aima', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

async function buscarDossieAima(id: string): Promise<Record<string, unknown>> {
  return authRequest<Record<string, unknown>>(`/api/aima/${encodeURIComponent(id)}/dossier`)
}

async function buscarDocumentosAima(id: string): Promise<AimaDocument[]> {
  return authRequest<AimaDocument[]>(`/api/aima/${encodeURIComponent(id)}/documents`)
}

export type AimaDocumentDownload = {
  blob: Blob
  fileName: string
}

async function baixarDocumentoAima({
  processId,
  fileName,
}: {
  processId: string
  fileName: string
}): Promise<AimaDocumentDownload> {
  const response = await fetch(
    `${API_BASE_URL}/api/aima/${encodeURIComponent(processId)}/documents/${encodeURIComponent(fileName)}`,
    {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ''}`,
        ...(getActiveCompanyId() ? { 'X-Company-Id': String(getActiveCompanyId()) } : {}),
      },
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Não foi possível baixar o documento AIMA.')
  }
  return { blob: await response.blob(), fileName: downloadFileName(response, fileName) }
}

async function reprocessarAima(id: string): Promise<AimaProcess> {
  return authRequest<AimaProcess>(`/api/aima/${encodeURIComponent(id)}/reprocess`, { method: 'POST' })
}

export function useAima() {
  const queryClient = useQueryClient()
  const aimaQuery = useQuery({ queryKey: ['aima'], queryFn: buscarAima })
  const createMutation = useMutation({
    mutationFn: criarAima,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aima'] }),
  })
  const dossierMutation = useMutation({ mutationFn: buscarDossieAima })
  const documentListMutation = useMutation({ mutationFn: buscarDocumentosAima })
  const singleDocMutation = useMutation({ mutationFn: baixarDocumentoAima })
  const reprocessMutation = useMutation({
    mutationFn: reprocessarAima,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aima'] }),
  })
  return {
    processes: computed(() => aimaQuery.data.value || []),
    isLoading: aimaQuery.isLoading,
    error: aimaQuery.error,
    criarAima: createMutation.mutateAsync,
    buscarDossie: dossierMutation.mutateAsync,
    buscarDocumentos: documentListMutation.mutateAsync,
    baixarDocumento: singleDocMutation.mutateAsync,
    reprocessar: reprocessMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isLoadingDossier: dossierMutation.isPending,
    isLoadingDocuments: documentListMutation.isPending,
    isDownloadingDocument: singleDocMutation.isPending,
    isReprocessing: reprocessMutation.isPending,
    refresh: aimaQuery.refetch,
  }
}
