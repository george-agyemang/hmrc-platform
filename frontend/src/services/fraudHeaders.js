// Collect device data for HMRC fraud prevention headers
// Called once per session, result stored in localStorage

function getOrCreateDeviceId() {
  let id = localStorage.getItem('hmrc_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('hmrc_device_id', id)
  }
  return id
}

function getTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offset = -new Date().getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const abs = Math.abs(offset)
    const hh = String(Math.floor(abs / 60)).padStart(2, '0')
    const mm = String(abs % 60).padStart(2, '0')
    return `UTC${sign}${hh}:${mm}`
  } catch { return 'UTC+00:00' }
}

function getScreens() {
  try {
    const s = window.screen
    const sf = window.devicePixelRatio || 1
    return `width=${s.width}&height=${s.height}&scaling-factor=${sf}&colour-depth=${s.colorDepth}`
  } catch { return 'width=1920&height=1080&scaling-factor=1&colour-depth=24' }
}

function getWindowSize() {
  try {
    return `width=${window.innerWidth}&height=${window.innerHeight}`
  } catch { return 'width=1280&height=720' }
}

function encode(str) {
  return encodeURIComponent(String(str))
}

export function collectFraudData() {
  return {
    deviceId:    getOrCreateDeviceId(),
    timezone:    getTimezone(),
    screens:     getScreens(),
    windowSize:  getWindowSize(),
    userAgent:   encode(navigator.userAgent),
    doNotTrack:  navigator.doNotTrack === '1' ? 'true' : 'false',
  }
}

export function fraudDataHeader() {
  try {
    const d = collectFraudData()
    return JSON.stringify(d)
  } catch { return '{}' }
}
