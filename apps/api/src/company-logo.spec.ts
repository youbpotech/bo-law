import { describe, expect, it } from 'vitest'
import { parseCompanyLogo } from './company-logo'

function pngDataUrl(width: number, height: number): string {
  const data = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data, 0)
  data.write('IHDR', 12, 'ascii')
  data.writeUInt32BE(width, 16)
  data.writeUInt32BE(height, 20)
  return `data:image/png;base64,${data.toString('base64')}`
}

describe('parseCompanyLogo', () => {
  it('aceita a medida gerada pelo recortador para o cabeçalho', () => {
    const logo = parseCompanyLogo(pngDataUrl(1024, 256))
    expect(logo).toMatchObject({ mimeType: 'image/png', width: 1024, height: 256 })
  })

  it('rejeita uma imagem quadrada inadequada ao cabeçalho', () => {
    expect(() => parseCompanyLogo(pngDataUrl(300, 300))).toThrow('proporção horizontal')
  })

  it('diferencia ausência, preservação e remoção', () => {
    expect(parseCompanyLogo(undefined)).toBeUndefined()
    expect(parseCompanyLogo(null)).toBeNull()
  })
})
