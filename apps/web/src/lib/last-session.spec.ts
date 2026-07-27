// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getLastSession, rememberLastSession } from './last-session'

describe('last session cookie', () => {
  beforeEach(() => {
    document.cookie = 'bo-last-session=; Max-Age=0; Path=/'
  })

  it('guarda somente usuário e empresa para recuperar o branding', () => {
    rememberLastSession({ username: 'antonio', companyId: 7 })

    expect(getLastSession()).toEqual({ username: 'antonio', companyId: 7 })
    expect(document.cookie).not.toContain('token')
    expect(document.cookie).not.toContain('password')
  })

  it('ignora cookies inválidos', () => {
    document.cookie = 'bo-last-session=invalid; Path=/'
    expect(getLastSession()).toBeNull()
  })
})
