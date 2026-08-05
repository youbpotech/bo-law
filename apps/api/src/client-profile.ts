import { Client } from './entities/Client'

export const FOREIGN_TAX_ID_TYPES = [
  'EU_VAT',
  'ES_NIF_NIE',
  'FR_NIF',
  'DE_STEUER_ID',
  'IT_CODICE_FISCALE',
  'BE_NATIONAL_NUMBER',
  'NL_BSN',
  'IE_PPSN',
  'UK_UTR_NINO',
  'CH_AHV',
  'US_SSN',
  'US_EIN',
  'CA_SIN_BN',
  'BR_CPF_CNPJ',
  'MX_RFC',
  'AR_CUIT_CUIL',
  'CL_RUT',
  'CO_NIT',
  'PE_RUC',
  'UY_RUT',
  'OTHER',
] as const

export const SEX_TYPES = ['FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED'] as const
export const MARITAL_STATUS_TYPES = [
  'SINGLE',
  'MARRIED',
  'DIVORCED',
  'WIDOWED',
  'SEPARATED',
  'CIVIL_UNION',
] as const
export const CIVIL_DOCUMENT_TYPES = [
  'CITIZEN_CARD',
  'IDENTITY_CARD',
  'PASSPORT',
  'RESIDENCE_PERMIT',
  'DRIVING_LICENCE',
  'OTHER',
] as const

function nullableText(value: unknown, maxLength: number, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`${field} inválido`)
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > maxLength) throw new Error(`${field} excede ${maxLength} caracteres`)
  return normalized
}

function nullableCountry(value: unknown, field: string): string | null {
  const country = nullableText(value, 10, field)
  return country?.toUpperCase() ?? null
}

function nullablePattern(
  value: unknown,
  pattern: RegExp,
  field: string,
  expectedFormat: string,
  uppercase = false,
): string | null {
  const normalized = nullableText(value, 50, field)
  if (!normalized) return null
  const result = uppercase ? normalized.toUpperCase() : normalized
  if (!pattern.test(result)) throw new Error(`${field} deve conter ${expectedFormat}`)
  return result
}

export function isValidCitizenCardNumber(value: string): boolean {
  if (!/^\d{9}[A-Z]{2}\d$/.test(value)) return false

  let sum = 0
  let doubleValue = false
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const character = value[index]
    let numericValue = /\d/.test(character)
      ? Number(character)
      : character.charCodeAt(0) - 'A'.charCodeAt(0) + 10

    if (doubleValue) {
      numericValue *= 2
      if (numericValue >= 10) numericValue -= 9
    }

    sum += numericValue
    doubleValue = !doubleValue
  }

  return sum % 10 === 0
}

function nullableCitizenCardNumber(value: unknown): string | null {
  const number = nullablePattern(
    value,
    /^\d{9}[A-Z]{2}\d$/,
    'N.º do Cartão de Cidadão',
    '8 dígitos, um dígito verificador, 2 letras e um dígito final',
    true,
  )
  if (number && !isValidCitizenCardNumber(number)) {
    throw new Error('N.º do Cartão de Cidadão possui dígito de controlo inválido')
  }
  return number
}

function nullableDate(value: unknown, field: string): string | null {
  const date = nullableText(value, 10, field)
  if (!date) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`${field} inválida`)
  }
  return date
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field} inválido`)
  return number
}

function nullableChoice<const T extends readonly string[]>(
  value: unknown,
  choices: T,
  field: string,
): T[number] | null {
  const normalized = nullableText(value, 50, field)
  if (!normalized) return null
  if (!choices.includes(normalized as T[number])) throw new Error(`${field} inválido`)
  return normalized as T[number]
}

export function applyClientProfileInput(client: Client, input: Record<string, unknown>): void {
  client.surname = nullableText(input.surname, 200, 'Apelido')
  client.portugueseTaxId = nullableText(input.portugueseTaxId, 20, 'NIF português')
  client.niss = nullablePattern(input.niss, /^\d{11}$/, 'NISS', 'exatamente 11 dígitos')
  client.snsUserNumber = nullablePattern(
    input.snsUserNumber,
    /^\d{9}$/,
    'Número de utente (SNS)',
    'exatamente 9 dígitos',
  )
  client.arNumber = nullablePattern(
    input.arNumber,
    /^[A-Z0-9]{9}$/,
    'Número AR',
    'exatamente 9 caracteres alfanuméricos',
    true,
  )
  client.citizenCardNumber = nullableCitizenCardNumber(input.citizenCardNumber)
  client.foreignTaxId = nullableText(input.foreignTaxId, 20, 'Identificação fiscal estrangeira')
  client.foreignTaxIdType = nullableChoice(
    input.foreignTaxIdType,
    FOREIGN_TAX_ID_TYPES,
    'Tipo de identificação fiscal estrangeira',
  )
  client.birthDate = nullableDate(input.birthDate, 'Data de nascimento')
  client.sex = nullableChoice(input.sex, SEX_TYPES, 'Sexo')
  client.maritalStatus = nullableChoice(input.maritalStatus, MARITAL_STATUS_TYPES, 'Estado civil')
  client.parent1Name = nullableText(input.parent1Name, 200, 'Nome do progenitor 1')
  client.parent1Surname = nullableText(input.parent1Surname, 200, 'Apelido do progenitor 1')
  client.parent2Name = nullableText(input.parent2Name, 200, 'Nome do progenitor 2')
  client.parent2Surname = nullableText(input.parent2Surname, 200, 'Apelido do progenitor 2')
  client.nationalityCountry = nullableCountry(input.nationalityCountry, 'País de nacionalidade')
  client.birthCountry = nullableCountry(input.birthCountry, 'País de naturalidade')
  client.birthProvince = nullableText(input.birthProvince, 200, 'Província/departamento')
  client.birthProvinceCode = nullableText(input.birthProvinceCode, 50, 'Código de província')
  client.birthPlace = nullableText(input.birthPlace, 200, 'Local de nascimento')
  client.birthDistrictId = nullableInteger(input.birthDistrictId, 'Distrito de naturalidade')
  client.birthMunicipalityId = nullableInteger(
    input.birthMunicipalityId,
    'Concelho de naturalidade',
  )
  client.birthParishId = nullableInteger(input.birthParishId, 'Freguesia de naturalidade')
  client.civilDocumentType = nullableChoice(
    input.civilDocumentType,
    CIVIL_DOCUMENT_TYPES,
    'Tipo de documento civil',
  )
  client.civilDocumentNumber = nullableText(
    input.civilDocumentNumber,
    100,
    'Número do documento civil',
  )
  client.civilDocumentExpiryDate = nullableDate(
    input.civilDocumentExpiryDate,
    'Validade do documento civil',
  )
  client.email = nullableText(input.email, 320, 'Email')
  client.mobileCountryCode = nullableText(input.mobileCountryCode, 10, 'Indicativo de telemóvel')
  client.mobile = nullableText(input.mobile, 30, 'Telemóvel')
  client.phoneCountryCode = nullableText(input.phoneCountryCode, 10, 'Indicativo de telefone')
  client.phone = nullableText(input.phone, 30, 'Telefone')
  client.residenceCountry = nullableCountry(input.residenceCountry, 'País de residência')
  client.residenceAddress = nullableText(input.residenceAddress, 500, 'Morada de residência')
  client.residenceLocality = nullableText(input.residenceLocality, 200, 'Localidade de residência')
  client.residencePostalCode = nullableText(input.residencePostalCode, 30, 'Código postal')
  client.residencePostalLocality = nullableText(
    input.residencePostalLocality,
    200,
    'Localidade postal',
  )
  client.residenceDistrictId = nullableInteger(input.residenceDistrictId, 'Distrito de residência')
  client.residenceMunicipalityId = nullableInteger(
    input.residenceMunicipalityId,
    'Concelho de residência',
  )
  client.residenceParishId = nullableInteger(input.residenceParishId, 'Freguesia de residência')
  client.foreignAddress = nullableText(input.foreignAddress, 500, 'Endereço estrangeiro')
  client.foreignAddress1 = nullableText(input.foreignAddress1, 500, 'Endereço estrangeiro 1')
  client.foreignAddress2 = nullableText(input.foreignAddress2, 500, 'Endereço estrangeiro 2')
  client.foreignCity = nullableText(input.foreignCity, 200, 'Cidade no estrangeiro')
  client.foreignRegion = nullableText(input.foreignRegion, 200, 'Região no estrangeiro')
  client.foreignPostalCode = nullableText(input.foreignPostalCode, 30, 'Código postal estrangeiro')
}
