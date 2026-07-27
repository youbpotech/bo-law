import { authRequest } from '@/composables/useApi'

export interface GeographyOption {
  value: string
  label: string
  custom: boolean
}

export function searchCountries(query: string): Promise<GeographyOption[]> {
  return authRequest(`/api/geography/countries?q=${encodeURIComponent(query)}`)
}

export function createCountry(name: string): Promise<GeographyOption> {
  return authRequest('/api/geography/countries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function searchStates(country: string, query: string): Promise<GeographyOption[]> {
  return authRequest(
    `/api/geography/states?country=${encodeURIComponent(country)}&q=${encodeURIComponent(query)}`,
  )
}

export function createState(country: string, name: string): Promise<GeographyOption> {
  return authRequest('/api/geography/states', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country, name }),
  })
}
