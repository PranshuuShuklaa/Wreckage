import { DEFAULT_GRAVITY, GRAVITY_FACTORS, MAX_STRENGTH, loadSettings, saveSettings } from '../shared/settings.js'

const doc = globalThis.document
const dial = doc.querySelector('#dial')
const modes = doc.querySelector('#modes')
const toggle = doc.querySelector('#toggle')
const notice = doc.querySelector('#notice')
const radius = 52
const directions = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
const labels = ['Earth', 'Moon', 'Zero-G', 'Reverse', 'Quake', 'Wrecking ball']
let gravity = DEFAULT_GRAVITY
let selected = 'earth'
let pointer = null
let tabId
let active = false
let dirty = false

for (let degree = 0; degree < 360; degree += 15) {
  const tick = doc.createElement('i')
  tick.className = degree % 90 === 0 ? 'tick major' : 'tick'
  tick.setAttribute('aria-hidden', 'true')
  tick.style.setProperty('--angle', degree + 'deg')
  dial.prepend(tick)
}

function paintGravity() {
  const { x, y, strength } = gravity
  const length = Math.hypot(x, y) || 1
  const distance = radius * strength / MAX_STRENGTH
  dial.style.setProperty('--x', distance * x / length + 'px')
  dial.style.setProperty('--y', distance * y / length + 'px')
  const angle = Math.atan2(y, x)
  const direction = directions[(Math.round(angle / (Math.PI / 4)) + 8) % 8]
  const text = strength ? strength.toFixed(1) + ' g · ' + direction : '0.0 g'
  doc.querySelector('#reading').value = text
  dial.setAttribute('aria-valuenow', strength.toFixed(2))
  dial.setAttribute('aria-valuetext', text)
}

function move(x, y) {
  const length = Math.hypot(x, y)
  const strength = Math.min(length, MAX_STRENGTH)
  gravity = { x: length ? x / length : 0, y: length ? y / length : 1, strength }
  dirty = true
  paintGravity()
  if (active) chrome.tabs.sendMessage(tabId, { type: 'SET_GRAVITY', gravity }, { frameId: 0 }).catch(() => {})
}

function commit() {
  if (!dirty) return
  dirty = false
  saveSettings({ gravity }).catch(showSaveError)
}

function showSaveError() {
  notice.textContent = 'Could not save settings. Try again.'
  notice.hidden = false
}

function drag(event) {
  if (event.pointerId !== pointer) return
  const rect = dial.getBoundingClientRect()
  move((event.clientX - rect.left - rect.width / 2) * MAX_STRENGTH / radius,
    (event.clientY - rect.top - rect.height / 2) * MAX_STRENGTH / radius)
}

dial.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0) return
  pointer = event.pointerId
  dial.setPointerCapture(pointer)
  drag(event)
}
dial.onpointermove = drag
dial.onlostpointercapture = () => { pointer = null; commit() }
const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
dial.onkeydown = event => {
  const step = arrows[event.key]
  if (!step) return
  event.preventDefault()
  const round = value => Math.round(value * 1000) / 1000
  move(round(gravity.x * gravity.strength + step[0] / 10), round(gravity.y * gravity.strength + step[1] / 10))
}
dial.onkeyup = commit
dial.onblur = commit

function selectMode(mode) {
  selected = mode
  for (const button of modes.children) button.setAttribute('aria-pressed', String(button.value === selected))
}

Object.keys(GRAVITY_FACTORS).forEach((mode, i) => {
  const button = doc.createElement('button')
  button.value = mode
  button.textContent = labels[i]
  button.onclick = () => {
    selectMode(mode)
    saveSettings({ mode }).catch(showSaveError)
  }
  modes.append(button)
})

function paintState(state) {
  active = Boolean(state?.active)
  toggle.classList.toggle('active', active)
  toggle.textContent = active ? 'Put it back' : 'Drop the page'
  toggle.disabled = !state
  notice.hidden = Boolean(state)
  if (!state) notice.textContent = "Can't run on this page. Try a regular website."
}

async function request(command) {
  toggle.disabled = true
  try {
    paintState(await chrome.runtime.sendMessage({ command, tabId }))
  } catch {
    paintState(null)
  }
}
toggle.onclick = () => request('popup-toggle')

async function init() {
  const settings = await loadSettings()
  const value = settings.gravity
  if (value && [value.x, value.y, value.strength].every(Number.isFinite)) gravity = value
  paintGravity()
  selectMode(Object.hasOwn(GRAVITY_FACTORS, settings.mode) ? settings.mode : 'earth')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  tabId = tab?.id
  if (tabId == null) return paintState(null)
  await request('popup-state')
}
init().catch(() => paintState(null))
