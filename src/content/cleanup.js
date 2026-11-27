import Matter from 'matter-js'
import { restoreElements } from './builder.js'

export function cleanup(session) {
  const { cancel, removeInput, engine, items, root, style, x, y, onKey } = session
  cancel?.()
  removeInput?.()
  globalThis.removeEventListener('keydown', onKey, true)
  restoreElements(items)
  if (style === null) root.removeAttribute('style')
  else root.setAttribute('style', style)
  globalThis.scrollTo({ left: x, top: y, behavior: 'instant' })
  Matter.Events.off(engine)
  Matter.Composite.clear(engine.world, false)
  Matter.Engine.clear(engine)
}
