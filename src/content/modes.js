import Matter from 'matter-js'
import {
  BALL, DEFAULT_GRAVITY, GRAVITY_FACTORS, LAYER, MAX_BODIES, MAX_STRENGTH, QUAKE,
} from '../shared/settings.js'

export function createModes(engine, items, renders, layer, mouse) {
  let mode = 'earth'
  let gravity = DEFAULT_GRAVITY
  let ball
  let spring
  let quakeTick
  let paused

  function applyGravity() {
    const factor = GRAVITY_FACTORS[mode] * gravity.strength
    const length = Math.hypot(gravity.x, gravity.y) || 1
    const x = gravity.x / length * factor
    const y = gravity.y / length * factor
    if (engine.gravity.x === x && engine.gravity.y === y) return
    Object.assign(engine.gravity, { x, y })
    for (const { body } of items) Matter.Sleeping.set(body, false)
  }

  function setGravity({ x, y, strength = gravity.strength } = {}) {
    if (![x, y, strength].every(Number.isFinite)) return
    gravity = { x, y, strength: Math.min(MAX_STRENGTH, Math.max(0, strength)) }
    applyGravity()
  }

  function quake() {
    let next = engine.timing.timestamp + QUAKE.interval
    let remaining = QUAKE.duration / QUAKE.interval
    quakeTick = () => {
      if (engine.timing.timestamp < next) return
      next += QUAKE.interval
      for (const { body } of items) {
        if (body.isSleeping) continue
        const kick = () => (Math.random() * 2 - 1) * QUAKE.speed
        Matter.Body.setVelocity(body, { x: body.velocity.x + kick(), y: body.velocity.y + kick() })
      }
      if (--remaining === 0) stopQuake()
    }
    Matter.Events.on(engine, 'beforeUpdate', quakeTick)
  }

  function stopQuake() {
    if (quakeTick) Matter.Events.off(engine, 'beforeUpdate', quakeTick)
    quakeTick = null
  }

  function addBall() {
    // At capacity the smallest page body holds its pose until the ball leaves.
    if (items.length === MAX_BODIES) {
      paused = renders.pop()
      Matter.Composite.remove(engine.world, paused.body)
    }
    const { radius, density, stiffness, damping, color } = BALL
    const body = Matter.Bodies.circle(mouse.position.x, mouse.position.y, radius, { density, sleepThreshold: 0 })
    spring = Matter.Constraint.create({ pointA: mouse.position, bodyB: body, length: 0, stiffness, damping })
    const visual = layer.ownerDocument.createElement('div')
    const diameter = radius * 2
    visual.style.cssText = `all:initial;position:fixed;inset:0 auto auto 0;width:${diameter}px;height:${diameter}px;border-radius:50%;background:${color};pointer-events:none;z-index:${LAYER}`
    visual.setAttribute('aria-hidden', 'true')
    ball = { visual, body, rect: { width: diameter, height: diameter } }
    layer.append(visual)
    renders.push(ball)
    Matter.Composite.add(engine.world, [body, spring])
  }

  function clear() {
    stopQuake()
    if (!ball) return
    Matter.Composite.remove(engine.world, [ball.body, spring])
    renders.pop()
    ball.visual.remove()
    ball = spring = null
    if (paused) {
      renders.push(paused)
      Matter.Composite.add(engine.world, paused.body)
      paused = null
    }
  }

  function setMode(value) {
    if (!Object.hasOwn(GRAVITY_FACTORS, value) || (value === mode && value !== 'quake')) return
    clear()
    mode = value
    applyGravity()
    if (mode === 'quake') quake()
    if (mode === 'wrecking-ball') addBall()
  }

  return { setGravity, setMode, clear }
}
