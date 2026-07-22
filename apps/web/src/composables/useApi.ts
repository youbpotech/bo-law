import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { getAuthToken, setAuthToken } from '@/lib/auth'

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
  company?: Company | null
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  surname?: string | null
  portugueseTaxId?: string | null
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
}

export type ClientInput = Pick<Client, 'name'> &
  Partial<
    Omit<Client, 'id' | 'name' | 'companyId' | 'createdAt' | 'updatedAt'>
  >

export interface CompanyInput {
  name: string
  theme: string
  logoDataUrl?: string | null
  whatsappNumber?: string | null
  dashboardConfig?: DashboardConfig
}

export async function authRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getAuthToken() ?? ''}`,
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
  token: string
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
    onSuccess: async ({ token, user }) => {
      const tenantKeys = new Set(['users', 'clients', 'leads', 'lead', 'cases', 'dashboard'])
      await queryClient.cancelQueries({
        predicate: (query) => tenantKeys.has(String(query.queryKey[0])),
      })
      setAuthToken(token)
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
