// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getLastSession, getSessionForUsername, rememberLastSession } from './last-session'

describe('last session cookie', () => {
  beforeEach(() => {
    document.cookie = 'bo-last-session=; Max-Age=0; Path=/'
    document.cookie = 'bo-user-sessions=; Max-Age=0; Path=/'
  })

  it('guarda o login, nome completo e empresa sem dados de autenticação', () => {
    rememberLastSession({
      username: 'Antonio',
      userName: 'António Silva',
      companyId: 7,
      colorTheme: 'dark',
    })

    expect(getLastSession()).toEqual({
      username: 'antonio',
      userName: 'António Silva',
      companyId: 7,
      colorTheme: 'dark',
    })
    expect(document.cookie).not.toContain('token')
    expect(document.cookie).not.toContain('password')
  })

  it('recupera nome, empresa e tema pela chave normalizada do login', () => {
    rememberLastSession({
      username: 'maria',
      userName: 'Maria Santos',
      companyId: 3,
      colorTheme: 'light',
    })
    rememberLastSession({
      username: 'antonio',
      userName: 'António Silva',
      companyId: 7,
      colorTheme: 'dark',
    })

    expect(getSessionForUsername(' MARIA ')).toEqual({
      username: 'maria',
      userName: 'Maria Santos',
      companyId: 3,
      colorTheme: 'light',
    })
    expect(getSessionForUsername('ANTONIO')).toEqual({
      username: 'antonio',
      userName: 'António Silva',
      companyId: 7,
      colorTheme: 'dark',
    })
  })

  it('mantém compatibilidade com o cookie anterior sem nome completo', () => {
    document.cookie = `bo-last-session=${encodeURIComponent(
      JSON.stringify({ username: 'antonio', companyId: 7 }),
    )}; Path=/`
    expect(getLastSession()).toEqual({ username: 'antonio', companyId: 7 })
  })

  it('ignora cookies inválidos', () => {
    document.cookie = 'bo-last-session=invalid; Path=/'
    expect(getLastSession()).toBeNull()
  })
})
