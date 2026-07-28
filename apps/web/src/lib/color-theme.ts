export const COLOR_THEMES = ['light', 'dark', 'system'] as const
export type ColorTheme = (typeof COLOR_THEMES)[number]

export function isColorTheme(value: unknown): value is ColorTheme {
  return typeof value === 'string' && COLOR_THEMES.includes(value as ColorTheme)
}
