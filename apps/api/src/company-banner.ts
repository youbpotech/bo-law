import { parseCompanyImage, type ParsedCompanyImage } from './company-image'

export const COMPANY_BANNER_MAX_BYTES = 2 * 1024 * 1024
export const COMPANY_BANNER_WIDTH = 1600
export const COMPANY_BANNER_HEIGHT = 1200

export function parseCompanyBanner(value: unknown): ParsedCompanyImage | null | undefined {
  return parseCompanyImage(value, {
    label: 'banner',
    maxBytes: COMPANY_BANNER_MAX_BYTES,
    maxBytesLabel: '2 MB',
    validateDimensions: (width, height) =>
      width === COMPANY_BANNER_WIDTH && height === COMPANY_BANNER_HEIGHT
        ? null
        : `O banner deve medir ${COMPANY_BANNER_WIDTH} × ${COMPANY_BANNER_HEIGHT} px`,
  })
}
