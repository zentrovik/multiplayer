function sanitizeSpeechText(text) {
  if (!text || typeof text !== 'string') return ''

  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const words = cleaned.split(/\s+/).filter((item) => item.length > 0)
  const safeWords = words.filter((word) => word.length <= 10 && /^[a-z]+$/.test(word))

  if (safeWords.length === 0) return ''

  return safeWords.join(' ')
}

export function playHDVoice(text, isSlow = true) {
  const safeText = sanitizeSpeechText(text)

  if (!safeText || typeof window === 'undefined') {
    return { ok: false, message: 'No easy word is available to pronounce.' }
  }

  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
    return { ok: false, message: 'Voice pronunciation is not supported in this browser.' }
  }

  const synthesis = window.speechSynthesis
  synthesis.cancel()

  const utterance = new window.SpeechSynthesisUtterance(safeText)
  utterance.rate = isSlow ? 0.7 : 0.9
  utterance.pitch = 1.08
  utterance.lang = 'en-US'

  const voices = synthesis.getVoices()
  const premiumVoice = voices.find(
    (voice) => voice.lang && voice.lang.toLowerCase().startsWith('en') &&
      (voice.name.toLowerCase().includes('google') || voice.name.toLowerCase().includes('natural') || voice.name.toLowerCase().includes('samantha'))
  )
  if (premiumVoice) utterance.voice = premiumVoice

  try {
    synthesis.speak(utterance)
    return { ok: true, message: '' }
  } catch (error) {
    console.error('[voiceEngine] Speech playback failed:', error)
    return { ok: false, message: 'Voice playback failed. Use the play button to try again.' }
  }
}