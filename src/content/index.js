let active = false

export function start() {
  active = true
  console.info('[Wreckage] active')
}

export function stop() {
  active = false
  console.info('[Wreckage] inactive')
}

// The command can inject this bundle repeatedly into the same isolated world.
if (globalThis.wreckageListenerId !== chrome.runtime.id) {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'WRECK_TOGGLE' && sender.id === chrome.runtime.id) {
      if (active) stop()
      else start()
      respond({ type: 'STATE', active, bodyCount: 0 })
    }
  })
  globalThis.wreckageListenerId = chrome.runtime.id
}
