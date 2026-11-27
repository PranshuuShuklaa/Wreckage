import Matter from 'matter-js'
import { MAX_STEPS, STEP_MS } from '../shared/settings.js'

export function animate(engine, items) {
  let previous = globalThis.performance.now()
  let accumulated = 0
  let id
  function frame(now) {
    accumulated += Math.min(now - previous, MAX_STEPS * STEP_MS)
    previous = now
    // Between physics steps the DOM already shows the current body poses.
    if (accumulated < STEP_MS) {
      id = globalThis.requestAnimationFrame(frame)
      return
    }
    while (accumulated >= STEP_MS) {
      Matter.Engine.update(engine, STEP_MS)
      accumulated -= STEP_MS
    }
    for (const { visual, rect, body, displayScale } of items) {
      if (body.isSleeping) continue
      const x = body.position.x - rect.width / 2
      const y = body.position.y - rect.height / 2
      visual.style.setProperty('transform', `translate(${x}px,${y}px) rotate(${body.angle}rad)${displayScale ? ` scale(${displayScale})` : ''}`, 'important')
    }
    id = globalThis.requestAnimationFrame(frame)
  }
  id = globalThis.requestAnimationFrame(frame)
  return () => globalThis.cancelAnimationFrame(id)
}
