import { MAX_BODIES, MIN_WIDTH, MIN_HEIGHT, MAX_AREA_SHARE } from '../shared/settings.js'

const atomic = 'img,svg,button,input,textarea,select,h1,h2,h3,h4,h5,h6,p,li,figure'
const skip = 'script,style,noscript,iframe,canvas,video,[hidden],template'

export function scanElements(width, height) {
  const items = []
  // Taking a wrapper as one body would move or clone the embedded media too.
  const mediaAncestors = new Set()
  for (const media of globalThis.document.body.querySelectorAll('iframe,canvas,video')) {
    for (let el = media.parentElement; el && !mediaAncestors.has(el); el = el.parentElement) {
      mediaAncestors.add(el)
    }
  }
  function visit(el) {
    if (el.matches(skip)) return false
    const rect = el.getBoundingClientRect()
    const area = rect.width * rect.height
    const eligible = !mediaAncestors.has(el) && rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT &&
      area <= width * height * MAX_AREA_SHARE && rect.right > 0 && rect.bottom > 0 &&
      rect.left < width && rect.top < height &&
      el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    const isPositionedHeader = eligible && el.matches('header,[role="banner"]') &&
      ['sticky', 'fixed'].includes(globalThis.getComputedStyle(el).position)
    if (eligible && (isPositionedHeader || el.matches(atomic) || (el.matches('a') &&
        !Array.from(el.children).some(child => /^(block|flex|grid|table|list-item|flow-root)/.test(globalThis.getComputedStyle(child).display))))) {
      items.push({ el, rect, area })
      return true
    }
    let hasBody = false
    for (const child of el.children) {
      if (visit(child)) hasBody = true
    }
    if (hasBody || !eligible || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return hasBody
    const css = globalThis.getComputedStyle(el)
    if (css.backgroundColor === 'rgba(0, 0, 0, 0)' && css.backgroundImage === 'none' &&
        ![css.borderTopWidth, css.borderBottomWidth, css.borderLeftWidth, css.borderRightWidth].some(parseFloat)) return false
    items.push({ el, rect, area })
    return true
  }
  for (const el of globalThis.document.body.children) visit(el)
  return items.sort((a, b) => b.area - a.area).slice(0, MAX_BODIES)
}
