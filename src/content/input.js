import Matter from 'matter-js'
import { LAYER } from '../shared/settings.js'

export function attachInput(engine, layer) {
  const overlay = globalThis.document.createElement('div')
  overlay.style.cssText = `all:initial;position:fixed;inset:0;z-index:${LAYER + 1};pointer-events:auto;touch-action:none;cursor:grab`
  layer.append(overlay)
  const mouse = Matter.Mouse.create(overlay)
  const constraint = Matter.MouseConstraint.create(engine, { mouse })
  Matter.Composite.add(engine.world, constraint)
  function release() {
    mouse.button = -1
  }
  globalThis.addEventListener('blur', release)
  globalThis.addEventListener('mouseup', release, true)
  overlay.addEventListener('touchcancel', release)
  return () => {
    globalThis.removeEventListener('blur', release)
    globalThis.removeEventListener('mouseup', release, true)
    overlay.removeEventListener('touchcancel', release)
    for (const [event, fn] of Object.entries({
      mousemove: mouse.mousemove, mousedown: mouse.mousedown, mouseup: mouse.mouseup,
      wheel: mouse.mousewheel, touchmove: mouse.mousemove, touchstart: mouse.mousedown, touchend: mouse.mouseup,
    })) overlay.removeEventListener(event, fn)
    Matter.Mouse.clearSourceEvents(mouse)
    overlay.remove()
  }
}
