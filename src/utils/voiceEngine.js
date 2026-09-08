export function playHDVoice(text, isSlow = true) {
  if (!text || typeof window === 'undefined') {
    return { ok: false, message: 'No word is available to pronounce.' }
  }

  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
    return { ok: false, message: 'Voice pronunciation is not supported in this browser.' }
  }

  const synthesis = window.speechSynthesis
  synthesis.cancel()

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.rate = isSlow ? 0.55 : 0.85
  utterance.pitch = 1.0
  utterance.lang = 'en-US'

  const voices = synthesis.getVoices()
  const premiumVoice = voices.find(
    (voice) => voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Samantha'))
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