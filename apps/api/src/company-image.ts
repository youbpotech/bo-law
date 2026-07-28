import { imageSize } from 'image-size'

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/

export type ParsedCompanyImage = {
  data: Buffer
  mimeType: string
  width: number
  height: number
}

type CompanyImageOptions = {
  label: string
  maxBytes: number
  maxBytesLabel: string
  validateDimensions: (width: number, height: number) => string | null
}

export function parseCompanyImage(
  value: unknown,
  options: CompanyImageOptions,
): ParsedCompanyImage | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`${options.label} inválido`)

  const match = DATA_URL_PATTERN.exec(value)
  if (!match) throw new Error(`O ${options.label} deve ser PNG, JPEG ou WebP`)
  const [, mimeType, encoded] = match
  if (!mimeType || !encoded || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`O ${options.label} deve ser PNG, JPEG ou WebP`)
  }

  const data = Buffer.from(encoded, 'base64')
  if (data.length === 0 || data.length > options.maxBytes) {
    throw new Error(`O ${options.label} deve ter no máximo ${options.maxBytesLabel}`)
  }

  let dimensions: ReturnType<typeof imageSize>
  try {
    dimensions = imageSize(data)
  } catch {
    throw new Error(`Não foi possível ler as dimensões do ${options.label}`)
  }

  const width = dimensions.width
  const height = dimensions.height
  if (!width || !height) throw new Error(`Não foi possível ler as dimensões do ${options.label}`)
  const detectedMimeType = dimensions.type === 'jpg' ? 'image/jpeg' : `image/${dimensions.type}`
  if (detectedMimeType !== mimeType) {
    throw new Error(`O conteúdo do ${options.label} não corresponde ao formato informado`)
  }

  const dimensionError = options.validateDimensions(width, height)
  if (dimensionError) throw new Error(dimensionError)
  return { data, mimeType, width, height }
}
