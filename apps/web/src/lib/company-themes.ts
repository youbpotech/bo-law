export const COMPANY_THEMES = [
  { value: 'default', labelKey: 'companies.defaultTheme' },
  { value: 'asap', labelKey: 'companies.asapTheme' },
  { value: 'pati-lemos', labelKey: 'companies.patiLemosTheme' },
  { value: 'me-associados', labelKey: 'companies.meAssociadosTheme' },
] as const

export type BrandTheme = (typeof COMPANY_THEMES)[number]['value']

export function isBrandTheme(value: string): value is BrandTheme {
  return COMPANY_THEMES.some((theme) => theme.value === value)
}

export function getCompanyTheme(value: string) {
  return COMPANY_THEMES.find((theme) => theme.value === value) ?? COMPANY_THEMES[0]
}
