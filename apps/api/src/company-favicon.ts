import { parseCompanyImage, type ParsedCompanyImage } from './company-image'

export const COMPANY_FAVICON_MAX_BYTES = 256 * 1024
export const COMPANY_FAVICON_MIN_SIZE = 32
export const COMPANY_FAVICON_MAX_SIZE = 512

export type ParsedCompanyFavicon = ParsedCompanyImage

export function parseCompanyFavicon(value: unknown): ParsedCompanyFavicon | null | undefined {
  return parseCompanyImage(value, {
    label: 'favicon',
    maxBytes: COMPANY_FAVICON_MAX_BYTES,
    maxBytesLabel: '256 KB',
    validateDimensions: (width, height) =>
      width !== height || width < COMPANY_FAVICON_MIN_SIZE || width > COMPANY_FAVICON_MAX_SIZE
        ? 'O favicon deve ser quadrado e medir entre 32 × 32 e 512 × 512 px'
        : null,
  })
}
