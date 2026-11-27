export const MIN_WIDTH = 24
export const MIN_HEIGHT = 12
export const MAX_AREA_SHARE = 0.6
export const MAX_BODIES = 150
export const WALL_SIZE = 100
export const STEP_MS = 1000 / 60
export const MAX_STEPS = 4
export const LAYER = 2147483646
export const MATERIAL = { restitution: 0.3, friction: 0.5, frictionAir: 0.01 }

export const DEFAULT_GRAVITY = { x: 0, y: 1, strength: 1 }
export const MAX_STRENGTH = 2
export const GRAVITY_FACTORS = { earth: 1, moon: 0.17, 'zero-g': 0, reverse: -1, quake: 1, 'wrecking-ball': 1 }
export const QUAKE = { interval: 80, duration: 2000, speed: 4 }
export const BALL = { radius: 28, density: 0.05, stiffness: 0.08, damping: 0.2, color: '#172033' }

export function loadSettings() {
  return chrome.storage.sync.get({ gravity: DEFAULT_GRAVITY, mode: 'earth' })
}

export function saveSettings() {}
