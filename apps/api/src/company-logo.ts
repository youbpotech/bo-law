import { parseCompanyImage, type ParsedCompanyImage } from './company-image'

export const COMPANY_LOGO_MAX_BYTES = 512 * 1024
export const COMPANY_LOGO_MIN_WIDTH = 120
export const COMPANY_LOGO_MAX_WIDTH = 1200
export const COMPANY_LOGO_MIN_HEIGHT = 32
export const COMPANY_LOGO_MAX_HEIGHT = 320
export const COMPANY_LOGO_MIN_ASPECT_RATIO = 1.5
export const COMPANY_LOGO_MAX_ASPECT_RATIO = 8

export type ParsedCompanyLogo = ParsedCompanyImage

export function parseCompanyLogo(value: unknown): ParsedCompanyLogo | null | undefined {
  return parseCompanyImage(value, {
    label: 'logomarca',
    maxBytes: COMPANY_LOGO_MAX_BYTES,
    maxBytesLabel: '512 KB',
    validateDimensions: (width, height) => {
      const aspectRatio = width / height
      return width < COMPANY_LOGO_MIN_WIDTH ||
        width > COMPANY_LOGO_MAX_WIDTH ||
        height < COMPANY_LOGO_MIN_HEIGHT ||
        height > COMPANY_LOGO_MAX_HEIGHT ||
        aspectRatio < COMPANY_LOGO_MIN_ASPECT_RATIO ||
        aspectRatio > COMPANY_LOGO_MAX_ASPECT_RATIO
        ? 'A logomarca deve ter 120–1200 px de largura, 32–320 px de altura e proporção horizontal entre 1,5:1 e 8:1'
        : null
    },
  })
}
