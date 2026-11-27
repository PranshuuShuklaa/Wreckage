import contentFile from './content/index.js?iife'

async function sendToPage(tabId, type = 'WRECK_TOGGLE') {
  await chrome.scripting.executeScript({ target: { tabId }, files: [contentFile] })
  return chrome.tabs.sendMessage(tabId, { type }, { frameId: 0 })
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle' && tab?.id != null) {
    sendToPage(tab.id).catch(error => console.warn('[Wreckage] Could not toggle this tab.', error.message))
  }
})

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL('src/popup/popup.html')) return
  if (!['popup-state', 'popup-toggle'].includes(message.command)) return
  const type = message.command === 'popup-state' ? 'GET_STATE' : 'WRECK_TOGGLE'
  sendToPage(message.tabId, type).then(respond, () => respond(null))
  return true
})
