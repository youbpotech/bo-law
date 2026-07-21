import { imageSize } from 'image-size'

export const COMPANY_LOGO_MAX_BYTES = 512 * 1024
export const COMPANY_LOGO_MIN_WIDTH = 120
export const COMPANY_LOGO_MAX_WIDTH = 1200
export const COMPANY_LOGO_MIN_HEIGHT = 32
export const COMPANY_LOGO_MAX_HEIGHT = 320
export const COMPANY_LOGO_MIN_ASPECT_RATIO = 1.5
export const COMPANY_LOGO_MAX_ASPECT_RATIO = 8

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/

export type ParsedCompanyLogo = {
  data: Buffer
  mimeType: string
  width: number
  height: number
}

export function parseCompanyLogo(value: unknown): ParsedCompanyLogo | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('Logomarca inválida')

  const match = DATA_URL_PATTERN.exec(value)
  if (!match) throw new Error('A logomarca deve ser PNG, JPEG ou WebP')

  const [, mimeType, encoded] = match
  if (!mimeType || !encoded || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('A logomarca deve ser PNG, JPEG ou WebP')
  }

  const data = Buffer.from(encoded, 'base64')
  if (data.length === 0 || data.length > COMPANY_LOGO_MAX_BYTES) {
    throw new Error('A logomarca deve ter no máximo 512 KB')
  }

  let dimensions: ReturnType<typeof imageSize>
  try {
    dimensions = imageSize(data)
  } catch {
    throw new Error('Não foi possível ler as dimensões da logomarca')
  }

  const width = dimensions.width
  const height = dimensions.height
  if (!width || !height) throw new Error('Não foi possível ler as dimensões da logomarca')
  const detectedMimeType = dimensions.type === 'jpg' ? 'image/jpeg' : `image/${dimensions.type}`
  if (detectedMimeType !== mimeType) throw new Error('O conteúdo da logomarca não corresponde ao formato informado')

  const aspectRatio = width / height
  if (
    width < COMPANY_LOGO_MIN_WIDTH ||
    width > COMPANY_LOGO_MAX_WIDTH ||
    height < COMPANY_LOGO_MIN_HEIGHT ||
    height > COMPANY_LOGO_MAX_HEIGHT ||
    aspectRatio < COMPANY_LOGO_MIN_ASPECT_RATIO ||
    aspectRatio > COMPANY_LOGO_MAX_ASPECT_RATIO
  ) {
    throw new Error(
      'A logomarca deve ter 120–1200 px de largura, 32–320 px de altura e proporção horizontal entre 1,5:1 e 8:1',
    )
  }

  return { data, mimeType, width, height }
}
