export const DEFAULT_COMPANY_LOGO_URL = '/branding/default-company-logo.png'
export const DEFAULT_LOGIN_BANNER_URL = '/branding/default-login-banner.png'

export function resolveCompanyLogoUrl(value?: string | null): string {
  return value || DEFAULT_COMPANY_LOGO_URL
}

export function resolveLoginBannerUrl(value?: string | null): string {
  return value || DEFAULT_LOGIN_BANNER_URL
}
