import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'node:zlib'
import { createZip } from './zip'

describe('createZip', () => {
  it('gera um arquivo ZIP com conteúdo descompactável', () => {
    const content = Buffer.from('documento NISS')
    const archive = createZip([{ name: 'documento.txt', data: content }])
    const nameLength = archive.readUInt16LE(26)
    const compressedSize = archive.readUInt32LE(18)
    const compressedStart = 30 + nameLength

    expect(archive.readUInt32LE(0)).toBe(0x04034b50)
    expect(archive.subarray(30, compressedStart).toString()).toBe('documento.txt')
    expect(inflateRawSync(archive.subarray(compressedStart, compressedStart + compressedSize))).toEqual(content)
    expect(archive.includes(Buffer.from('PK\x05\x06', 'binary'))).toBe(true)
  })
})
