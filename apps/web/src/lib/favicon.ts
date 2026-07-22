const DEFAULT_FAVICON = '/favicon-default.svg'

export function setBrowserFavicon(url?: string | null): void {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((link) => link.remove())
  const href = url || DEFAULT_FAVICON
  for (const rel of ['icon', 'shortcut icon']) {
    const link = document.createElement('link')
    link.rel = rel
    link.href = href
    document.head.appendChild(link)
  }
}
