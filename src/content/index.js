import { cleanup } from './cleanup.js'
import { attachInput } from './input.js'
import { scanElements } from './scanner.js'
import { detachElements } from './builder.js'
import { createWorld } from './world.js'
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
  const root = globalThis.document.documentElement
  const width = root.clientWidth
  const height = root.clientHeight
  const items = scanElements(width, height)
  const engine = createWorld(items, width, height)
  session = { items, engine, root, onKey, style: root.getAttribute('style'), x: globalThis.scrollX, y: globalThis.scrollY }
  try {
    detachElements(items)
    root.style.setProperty('overflow', 'hidden', 'important')
    globalThis.addEventListener('keydown', onKey, true)
    session.removeInput = attachInput(engine)
    session.cancel = animate(engine, items)
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
    if (message.type === 'WRECK_TOGGLE' && sender.id === chrome.runtime.id) {
      if (session) stop()
      else start()
      respond({ type: 'STATE', active: Boolean(session), bodyCount: session?.items.length ?? 0 })
    }
  })
  globalThis.wreckageListenerId = chrome.runtime.id
}
