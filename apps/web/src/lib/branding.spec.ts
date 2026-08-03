import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPANY_LOGO_URL,
  DEFAULT_LOGIN_BANNER_URL,
  resolveCompanyLogoUrl,
  resolveLoginBannerUrl,
} from './branding'

describe('fallbacks de identidade visual', () => {
  it('usa os assets do projeto quando a empresa não possui imagens', () => {
    expect(resolveCompanyLogoUrl(null)).toBe(DEFAULT_COMPANY_LOGO_URL)
    expect(resolveLoginBannerUrl(null)).toBe(DEFAULT_LOGIN_BANNER_URL)
  })

  it('preserva as imagens configuradas pela empresa', () => {
    expect(resolveCompanyLogoUrl('/api/companies/2/logo')).toBe('/api/companies/2/logo')
    expect(resolveLoginBannerUrl('/api/branding/companies/2/login-banner')).toBe(
      '/api/branding/companies/2/login-banner',
    )
  })
})
