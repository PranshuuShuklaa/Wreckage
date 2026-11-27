import contentFile from './content/index.js?iife'

async function toggle(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: [contentFile] })
  await chrome.tabs.sendMessage(tabId, { type: 'WRECK_TOGGLE' }, { frameId: 0 })
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle' && tab?.id != null) {
    toggle(tab.id).catch(error => console.warn('[Wreckage] Could not toggle this tab.', error.message))
  }
})
