import { imageSize } from 'image-size'

export const COMPANY_FAVICON_MAX_BYTES = 256 * 1024
export const COMPANY_FAVICON_MIN_SIZE = 32
export const COMPANY_FAVICON_MAX_SIZE = 512

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/

export type ParsedCompanyFavicon = {
  data: Buffer
  mimeType: string
  width: number
  height: number
}

export function parseCompanyFavicon(value: unknown): ParsedCompanyFavicon | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('Favicon inválido')

  const match = DATA_URL_PATTERN.exec(value)
  if (!match) throw new Error('O favicon deve ser PNG, JPEG ou WebP')
  const [, mimeType, encoded] = match
  if (!mimeType || !encoded || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('O favicon deve ser PNG, JPEG ou WebP')
  }

  const data = Buffer.from(encoded, 'base64')
  if (data.length === 0 || data.length > COMPANY_FAVICON_MAX_BYTES) {
    throw new Error('O favicon deve ter no máximo 256 KB')
  }

  let dimensions: ReturnType<typeof imageSize>
  try {
    dimensions = imageSize(data)
  } catch {
    throw new Error('Não foi possível ler as dimensões do favicon')
  }
  const width = dimensions.width
  const height = dimensions.height
  if (!width || !height) throw new Error('Não foi possível ler as dimensões do favicon')
  const detectedMimeType = dimensions.type === 'jpg' ? 'image/jpeg' : `image/${dimensions.type}`
  if (detectedMimeType !== mimeType) throw new Error('O conteúdo do favicon não corresponde ao formato informado')
  if (
    width !== height ||
    width < COMPANY_FAVICON_MIN_SIZE ||
    width > COMPANY_FAVICON_MAX_SIZE
  ) {
    throw new Error('O favicon deve ser quadrado e medir entre 32 × 32 e 512 × 512 px')
  }
  return { data, mimeType, width, height }
}
