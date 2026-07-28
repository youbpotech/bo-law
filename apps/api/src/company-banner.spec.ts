import { describe, expect, it } from 'vitest'
import { parseCompanyBanner } from './company-banner'

function pngDataUrl(width: number, height: number): string {
  const data = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data, 0)
  data.write('IHDR', 12, 'ascii')
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

describe('parseCompanyBanner', () => {
  it('aceita o banner gerado pelo recortador', () => {
    expect(parseCompanyBanner(pngDataUrl(1600, 1200))).toMatchObject({
      mimeType: 'image/png',
      width: 1600,
      height: 1200,
    })
  })

  it('rejeita banner com resolução diferente da saída esperada', () => {
    expect(() => parseCompanyBanner(pngDataUrl(800, 600))).toThrow('1600 × 1200')
  })

  it('diferencia preservação e remoção', () => {
    expect(parseCompanyBanner(undefined)).toBeUndefined()
    expect(parseCompanyBanner(null)).toBeNull()
  })
})
