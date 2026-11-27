import { LAYER } from '../shared/settings.js'

function trapped(el) {
  for (let parent = el.parentElement; parent && parent !== el.ownerDocument.body; parent = parent.parentElement) {
    const css = globalThis.getComputedStyle(parent)
    if ([css.transform, css.filter, css.perspective].some(value => value !== 'none') ||
        /layout|paint|strict|content/.test(css.contain)) return true
  }
  return false
}

function makeVisual(el) {
  const clone = el.cloneNode(true)
  const originals = [el, ...el.querySelectorAll('*')]
  const copies = [clone, ...clone.querySelectorAll('*')]
  originals.forEach((original, i) => {
    const copy = copies[i]
    const css = globalThis.getComputedStyle(original)
    for (const key of css) copy.style?.setProperty(key, css.getPropertyValue(key))
    copy.removeAttribute('id')
    copy.removeAttribute('name')
    copy.removeAttribute('autofocus')
  })
  clone.setAttribute('aria-hidden', 'true')
  clone.inert = true
  return clone
}

export function detachElements(items) {
  // Capture flow styles before any sibling selectors or layout can change.
  for (const item of items) {
    const { el, rect } = item
    item.originalStyle = el.getAttribute('style')
    item.visual = trapped(el) ? makeVisual(el) : el
    if (item.visual !== el) continue
    const css = globalThis.getComputedStyle(el)
    const placeholder = el.ownerDocument.createElement('span')
    placeholder.setAttribute('aria-hidden', 'true')
    for (const key of ['position', 'inset', 'display', 'margin', 'float', 'clear', 'vertical-align',
      'order', 'align-self', 'justify-self', 'grid-area', 'flex']) {
      placeholder.style.setProperty(key, css.getPropertyValue(key))
    }
    placeholder.style.cssText += `;visibility:hidden!important;pointer-events:none!important;box-sizing:border-box;width:${rect.width}px;height:${rect.height}px`
    if (css.display === 'inline') placeholder.style.display = 'inline-block'
    item.placeholder = placeholder
  }
  for (const item of items) {
    const { el, rect, placeholder, visual } = item
    if (visual === el) el.before(placeholder)
    else {
      el.ownerDocument.body.append(visual)
      el.style.setProperty('opacity', '0', 'important')
    }
    // Record detachment even if the page later removes the placeholder.
    item.detached = true
    visual.style.cssText += `;position:fixed!important;pointer-events:none!important;inset:0 auto auto 0!important;margin:0!important;box-sizing:border-box!important;width:${rect.width}px!important;height:${rect.height}px!important;transition:none!important;transform-origin:center!important;will-change:transform;z-index:${LAYER}!important;transform:translate(${rect.x}px,${rect.y}px)!important`
  }
}

export function restoreElements(items) {
  for (const { el, originalStyle, placeholder, visual, detached } of items) {
    if (!detached) continue
    placeholder?.remove()
    if (visual !== el) visual.remove()
    if (originalStyle === null) el.removeAttribute('style')
    else el.setAttribute('style', originalStyle)
  }
}
