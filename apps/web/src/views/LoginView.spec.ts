// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { rememberLastSession } from '@/lib/last-session'
import {
  DEFAULT_COMPANY_LOGO_URL,
  DEFAULT_LOGIN_BANNER_URL,
} from '@/lib/branding'
import LoginView from './LoginView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

const wrappers: VueWrapper[] = []

beforeEach(() => {
  document.cookie = 'bo-last-session=; Max-Age=0; Path=/'
  document.cookie = 'bo-user-sessions=; Max-Age=0; Path=/'
  document.documentElement.classList.remove('dark')
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            name: url.endsWith('/3') ? 'Empresa Maria' : 'Empresa António',
            theme: 'default',
            logoUrl: null,
            faviconUrl: null,
            loginBannerUrl: null,
          }),
      }),
    ),
  )
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('LoginView por utilizador lembrado', () => {
  it('altera nome e tema quando o login digitado muda', async () => {
    const wrapper = mount(LoginView)
    wrappers.push(wrapper)
    await flushPromises()

    expect(wrapper.text()).toContain('António Silva')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(wrapper.get(`img[src="${DEFAULT_LOGIN_BANNER_URL}"]`).attributes('src')).toBe(
      DEFAULT_LOGIN_BANNER_URL,
    )
    expect(wrapper.get(`img[src="${DEFAULT_COMPANY_LOGO_URL}"]`).attributes('src')).toBe(
      DEFAULT_COMPANY_LOGO_URL,
    )

    await wrapper.get('#username').setValue(' MARIA ')
    await flushPromises()

    expect(wrapper.text()).toContain('Maria Santos')
    expect(wrapper.text()).not.toContain('António Silva')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
