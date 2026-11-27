import fontUrl from './hud-archivo.woff2?inline'
import { HUD_DELAY_MS, LAYER } from '../shared/settings.js'

export function showHud(layer) {
  const doc = layer.ownerDocument
  const host = doc.createElement('div')
  const shadow = host.attachShadow({ mode: 'closed' })
  const sheet = new globalThis.CSSStyleSheet()
  sheet.replaceSync(`
    :host {
      all: initial !important;
      position: fixed !important;
      left: 50% !important;
      bottom: 16px !important;
      transform: translateX(-50%) !important;
      display: block !important;
      z-index: ${LAYER + 1} !important;
      pointer-events: auto !important;
      direction: ltr !important;
    }
    span {
      display: block;
      padding: 8px 16px;
      border-radius: 999px;
      background: #172033;
      color: #D3D8DB;
      font: 450 14px/1.25 WreckageArchivo, sans-serif;
      white-space: nowrap;
      user-select: none;
      transition: opacity 160ms ease-out;
    }
    span.faded { opacity: 0; }
    :host(:hover) span { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { span { transition: none; } }
  `)
  shadow.adoptedStyleSheets = [sheet]
  const pill = doc.createElement('span')
  pill.textContent = 'Esc puts it back'
  shadow.append(pill)
  const bytes = Uint8Array.from(globalThis.atob(fontUrl.split(',')[1]), char => char.charCodeAt(0))
  const font = new globalThis.FontFace('WreckageArchivo', bytes, { weight: '450' })
  doc.fonts.add(font)
  layer.append(host)
  const timer = globalThis.setTimeout(() => pill.classList.add('faded'), HUD_DELAY_MS)
  return () => {
    globalThis.clearTimeout(timer)
    host.remove()
    doc.fonts.delete(font)
  }
}
