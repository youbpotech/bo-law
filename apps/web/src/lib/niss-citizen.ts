import type { Client, ClientInput } from '@/composables/useApi'

type ClientField = keyof ClientInput
type Citizen = Record<string, unknown>
type FieldValue = string | number | null

export interface CitizenComparison {
  key: ClientField
  label: string
  currentValue: FieldValue
  nissValue: FieldValue
}

export interface CitizenDetail {
  key: string
  label: string
  value: string
}

const fieldDefinitions: Array<{
  key: ClientField
  source: string
  label: string
  normalize?: (value: unknown) => FieldValue
}> = [
  { key: 'name', source: 'nome', label: 'Nome' },
  { key: 'surname', source: 'apelido', label: 'Apelido' },
  { key: 'portugueseTaxId', source: 'nif', label: 'NIF português' },
  { key: 'birthDate', source: 'data_nascimento', label: 'Data de nascimento', normalize: date },
  { key: 'sex', source: 'sexo', label: 'Sexo', normalize: sex },
  { key: 'maritalStatus', source: 'estado_civil', label: 'Estado civil', normalize: maritalStatus },
  { key: 'parent1Name', source: 'nome_progenitor_1', label: 'Nome do progenitor 1' },
  { key: 'parent1Surname', source: 'apelido_progenitor_1', label: 'Apelido do progenitor 1' },
  { key: 'parent2Name', source: 'nome_progenitor_2', label: 'Nome do progenitor 2' },
  { key: 'parent2Surname', source: 'apelido_progenitor_2', label: 'Apelido do progenitor 2' },
  {
    key: 'nationalityCountry',
    source: 'pais_nacionalidade',
    label: 'País de nacionalidade',
    normalize: upper,
  },
  {
    key: 'birthCountry',
    source: 'pais_naturalidade',
    label: 'País de naturalidade',
    normalize: upper,
  },
  { key: 'birthProvince', source: 'provincia_departamento', label: 'Província/departamento' },
  { key: 'birthProvinceCode', source: 'codigo_provincia', label: 'Código da província' },
  { key: 'birthPlace', source: 'local_nascimento', label: 'Local de nascimento' },
  {
    key: 'birthDistrictId',
    source: 'distrito_naturalidade',
    label: 'Distrito de naturalidade',
    normalize: integer,
  },
  {
    key: 'birthMunicipalityId',
    source: 'concelho_naturalidade',
    label: 'Concelho de naturalidade',
    normalize: integer,
  },
  {
    key: 'birthParishId',
    source: 'freguesia_naturalidade',
    label: 'Freguesia de naturalidade',
    normalize: integer,
  },
  {
    key: 'civilDocumentType',
    source: 'tipo_documento_civil',
    label: 'Tipo de documento civil',
    normalize: documentType,
  },
  {
    key: 'civilDocumentNumber',
    source: 'numero_documento_civil',
    label: 'Número do documento civil',
  },
  {
    key: 'civilDocumentExpiryDate',
    source: 'data_validade_documento_civil',
    label: 'Validade do documento civil',
    normalize: date,
  },
  { key: 'email', source: 'email', label: 'Email' },
  { key: 'mobileCountryCode', source: 'indicativo_telemovel', label: 'Indicativo do telemóvel' },
  { key: 'mobile', source: 'telemovel', label: 'Telemóvel' },
  { key: 'phoneCountryCode', source: 'indicativo_telefone', label: 'Indicativo do telefone' },
  { key: 'phone', source: 'telefone', label: 'Telefone' },
  {
    key: 'residenceCountry',
    source: 'pais_residencia',
    label: 'País de residência',
    normalize: upper,
  },
  { key: 'residenceAddress', source: 'morada_residencia', label: 'Morada de residência' },
  { key: 'residenceLocality', source: 'localidade_residencia', label: 'Localidade de residência' },
  { key: 'residencePostalCode', source: 'codigo_postal_residencia', label: 'Código postal' },
  { key: 'residencePostalLocality', source: 'localidade_postal', label: 'Localidade postal' },
  {
    key: 'residenceDistrictId',
    source: 'distrito_residencia',
    label: 'Distrito de residência',
    normalize: integer,
  },
  {
    key: 'residenceMunicipalityId',
    source: 'concelho_residencia',
    label: 'Concelho de residência',
    normalize: integer,
  },
  {
    key: 'residenceParishId',
    source: 'freguesia_residencia',
    label: 'Freguesia de residência',
    normalize: integer,
  },
  { key: 'foreignAddress', source: 'endereco_estrangeiro', label: 'Endereço estrangeiro' },
  {
    key: 'foreignAddress1',
    source: 'endereco_estrangeiro_1',
    label: 'Endereço estrangeiro — linha 1',
  },
  {
    key: 'foreignAddress2',
    source: 'endereco_estrangeiro_2',
    label: 'Endereço estrangeiro — linha 2',
  },
  { key: 'foreignCity', source: 'cidade_estrangeiro', label: 'Cidade no estrangeiro' },
  { key: 'foreignRegion', source: 'regiao_estrangeiro', label: 'Região no estrangeiro' },
  {
    key: 'foreignPostalCode',
    source: 'codigo_postal_estrangeiro',
    label: 'Código postal estrangeiro',
  },
]

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function upper(value: unknown): string | null {
  return text(value)?.toUpperCase() ?? null
}

function date(value: unknown): string | null {
  return text(value)?.slice(0, 10) ?? null
}

function integer(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizedChoice(value: unknown, aliases: Record<string, string>): string | null {
  const normalized = upper(value)
    ?.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return normalized ? (aliases[normalized] ?? null) : null
}

function sex(value: unknown): string | null {
  return normalizedChoice(value, {
    F: 'FEMALE',
    FEMININO: 'FEMALE',
    FEMALE: 'FEMALE',
    M: 'MALE',
    MASCULINO: 'MALE',
    MALE: 'MALE',
    OUTRO: 'OTHER',
    OTHER: 'OTHER',
    NAO_ESPECIFICADO: 'UNSPECIFIED',
    UNSPECIFIED: 'UNSPECIFIED',
  })
}

function maritalStatus(value: unknown): string | null {
  return normalizedChoice(value, {
    SOLTEIRO: 'SINGLE',
    SOLTEIRA: 'SINGLE',
    SINGLE: 'SINGLE',
    CASADO: 'MARRIED',
    CASADA: 'MARRIED',
    MARRIED: 'MARRIED',
    DIVORCIADO: 'DIVORCED',
    DIVORCIADA: 'DIVORCED',
    DIVORCED: 'DIVORCED',
    VIUVO: 'WIDOWED',
    VIUVA: 'WIDOWED',
    WIDOWED: 'WIDOWED',
    SEPARADO: 'SEPARATED',
    SEPARADA: 'SEPARATED',
    SEPARATED: 'SEPARATED',
    UNIAO_DE_FACTO: 'CIVIL_UNION',
    CIVIL_UNION: 'CIVIL_UNION',
  })
}

function documentType(value: unknown): string | null {
  return normalizedChoice(value, {
    CARTAO_DE_CIDADAO: 'CITIZEN_CARD',
    CITIZEN_CARD: 'CITIZEN_CARD',
    BILHETE_DE_IDENTIDADE: 'IDENTITY_CARD',
    IDENTITY_CARD: 'IDENTITY_CARD',
    PASSAPORTE: 'PASSPORT',
    PASSPORT: 'PASSPORT',
    TITULO_DE_RESIDENCIA: 'RESIDENCE_PERMIT',
    RESIDENCE_PERMIT: 'RESIDENCE_PERMIT',
    CARTA_DE_CONDUCAO: 'DRIVING_LICENCE',
    DRIVING_LICENCE: 'DRIVING_LICENCE',
    OUTRO: 'OTHER',
    OTHER: 'OTHER',
  })
}

export function dossierCitizen(dossier: Record<string, unknown> | null): Citizen | null {
  const citizen = dossier?.cidadao
  return typeof citizen === 'object' && citizen !== null && !Array.isArray(citizen)
    ? (citizen as Citizen)
    : null
}

export function citizenComparisons(client: Client, citizen: Citizen): CitizenComparison[] {
  return fieldDefinitions.flatMap((field) => {
    const nissValue = field.normalize
      ? field.normalize(citizen[field.source])
      : text(citizen[field.source])
    if (nissValue === null) return []
    const currentValue = (client[field.key] ?? null) as FieldValue
    return [{ key: field.key, label: field.label, currentValue, nissValue }]
  })
}

export function citizenDetails(citizen: Citizen): CitizenDetail[] {
  return fieldDefinitions.flatMap((field) => {
    const value = text(citizen[field.source])
    return value === null ? [] : [{ key: field.source, label: field.label, value }]
  })
}

export function mergedClientInput(
  client: Client,
  comparisons: CitizenComparison[],
  selected: Set<ClientField>,
): ClientInput {
  const ignored = new Set(['id', 'companyId', 'createdAt', 'updatedAt'])
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(client)) {
    if (!ignored.has(key)) result[key] = value ?? null
  }
  for (const comparison of comparisons) {
    if (selected.has(comparison.key)) result[comparison.key] = comparison.nissValue
  }
  return result as ClientInput
}

export function displayCitizenValue(value: FieldValue): string {
  if (value === null || value === '') return '—'
  return String(value)
}
