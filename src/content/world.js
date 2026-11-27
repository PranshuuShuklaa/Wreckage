import Matter from 'matter-js'
import { MATERIAL, WALL_SIZE } from '../shared/settings.js'

function makeWalls(width, height) {
  const wall = (x, y, w, h) => Matter.Bodies.rectangle(x, y, w, h, { isStatic: true })
  const t = WALL_SIZE
  return [
    wall(width / 2, height + t / 2, width + 2 * t, t),
    wall(width / 2, -t / 2, width + 2 * t, t),
    wall(-t / 2, height / 2, t, height),
    wall(width + t / 2, height / 2, t, height),
  ]
}

export function createWorld(items, width, height) {
  const engine = Matter.Engine.create({ enableSleeping: true })
  Matter.Composite.add(engine.world, makeWalls(width, height))
  for (const item of items) {
    const { x, y, width, height } = item.rect
    item.body = Matter.Bodies.rectangle(x + width / 2, y + height / 2, width, height, MATERIAL)
    Matter.Composite.add(engine.world, item.body)
  }
  return engine
}

export function resizeWorld(engine, width, height, previousWidth, previousHeight, scaleRatio, items) {
  // Only the four viewport boundaries are static in this world.
  const walls = engine.world.bodies.filter(body => body.isStatic)
  Matter.Composite.remove(engine.world, walls)
  // Scale the pile together on shrink; independently clamping large bodies
  // stacks them on the same boundary and can push smaller bodies through it.
  for (const item of items) {
    const { body } = item
    const center = body.position
    const before = item.displayScale ?? 1
    const after = Math.min(1, before * scaleRatio)
    if (after !== before) {
      Matter.Body.scale(body, after / before, after / before)
      item.displayScale = after
    }
    const { min, max } = body.bounds
    const dx = fitOffset(min.x, max.x, width, center.x * (width / previousWidth - 1))
    const dy = fitOffset(min.y, max.y, height, center.y * (height / previousHeight - 1))
    if (dx || dy) Matter.Body.translate(body, { x: dx, y: dy })
    Matter.Sleeping.set(body, false)
  }
  Matter.Composite.add(engine.world, makeWalls(width, height))
}

function fitOffset(min, max, limit, scaled) {
  if (max - min > limit) return (limit - min - max) / 2
  return Math.max(-min, Math.min(scaled, limit - max))
}
