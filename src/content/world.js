import Matter from 'matter-js'
import { MATERIAL, WALL_SIZE } from '../shared/settings.js'

export function createWorld(items, width, height) {
  const engine = Matter.Engine.create({ enableSleeping: true })
  const wall = (x, y, w, h) => Matter.Bodies.rectangle(x, y, w, h, { isStatic: true })
  const t = WALL_SIZE
  Matter.Composite.add(engine.world, [
    wall(width / 2, height + t / 2, width + 2 * t, t),
    wall(width / 2, -t / 2, width + 2 * t, t),
    wall(-t / 2, height / 2, t, height),
    wall(width + t / 2, height / 2, t, height),
  ])
  for (const item of items) {
    const { x, y, width, height } = item.rect
    item.body = Matter.Bodies.rectangle(x + width / 2, y + height / 2, width, height, MATERIAL)
    Matter.Composite.add(engine.world, item.body)
  }
  return engine
}
