import { showHud } from './hud.js'
import { createModes } from './modes.js'
import { loadSettings } from '../shared/settings.js'
import { cleanup } from './cleanup.js'
import { attachInput } from './input.js'
import { scanElements } from './scanner.js'
import { detachElements } from './builder.js'
import { createWorld, resizeWorld } from './world.js'
import { animate } from './loop.js'

let session

function onKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    stop()
  }
}

export function start() {
  if (session) return
  const root = globalThis.document.scrollingElement ?? globalThis.document.documentElement
  const width = globalThis.document.compatMode === 'BackCompat' ? globalThis.innerWidth : root.clientWidth
  const height = globalThis.innerHeight
  const items = scanElements(width, height)
  const engine = createWorld(items, width, height)
  session = { items, engine, root, onKey, style: root.getAttribute('style'), x: globalThis.scrollX, y: globalThis.scrollY }
  try {
    // The top layer escapes fixed-position containing blocks on body and html.
    const layer = globalThis.document.createElement('div')
    session.layer = layer
    layer.popover = 'manual'
    layer.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none'
    globalThis.document.body.append(layer)
    layer.showPopover()
    detachElements(items, layer)
    root.style.setProperty('overflow', 'hidden', 'important')
    globalThis.addEventListener('keydown', onKey, true)
    const { mouse, remove } = attachInput(engine, layer)
    session.removeInput = remove
    session.removeHud = showHud(layer)
    const renders = [...items]
    session.renders = renders
    const modes = createModes(engine, items, renders, layer, mouse)
    session.modes = modes
    const updated = new Set()
    session.update = (key, value) => {
      updated.add(key)
      if (key === 'mode') modes.setMode(value)
      else if (value) modes.setGravity(value)
    }
    const onSettings = changes => {
      for (const key of ['gravity', 'mode']) {
        if (changes[key]) session.update(key, changes[key].newValue)
      }
    }
    chrome.storage.sync.onChanged.addListener(onSettings)
    session.removeSettings = () => chrome.storage.sync.onChanged.removeListener(onSettings)
    loadSettings().then(settings => {
      if (session?.modes !== modes) return
      if (!updated.has('gravity')) modes.setGravity(settings.gravity)
      if (!updated.has('mode')) modes.setMode(settings.mode)
    }).catch(error => console.warn('[Wreckage] Could not load settings.', error.message))
    let previousWidth = width
    let previousHeight = height
    let previousScale = 1
    const onResize = () => {
      const w = globalThis.document.compatMode === 'BackCompat' ? globalThis.innerWidth : root.clientWidth
      const h = globalThis.innerHeight
      if (!w || !h || (w === previousWidth && h === previousHeight)) return
      const scale = Math.min(1, w / width, h / height)
      resizeWorld(engine, w, h, previousWidth, previousHeight, scale / previousScale,
        new Set([...items, ...renders]))
      previousScale = scale
      previousWidth = w
      previousHeight = h
    }
    globalThis.addEventListener('resize', onResize)
    session.removeResize = () => globalThis.removeEventListener('resize', onResize)
    session.cancel = animate(engine, renders)
  } catch (error) {
    stop()
    throw error
  }
}

export function stop() {
  if (!session) return
  cleanup(session)
  session = null
}
// The command can inject this bundle repeatedly into the same isolated world.
if (globalThis.wreckageListenerId !== chrome.runtime.id) {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return
    if (message.type === 'SET_MODE') session?.update('mode', message.mode)
    else if (message.type === 'SET_GRAVITY') session?.update('gravity', message.gravity ?? message)
    else if (message.type === 'WRECK_TOGGLE') {
      if (session) stop()
      else start()
    } else if (message.type !== 'GET_STATE') return
    respond({ type: 'STATE', active: Boolean(session), bodyCount: session?.renders.length ?? 0 })
  })
  globalThis.wreckageListenerId = chrome.runtime.id
}
