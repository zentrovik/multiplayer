import nspell from 'nspell'
import aff from '../data/en.aff?raw'
import dic from '../data/en.dic?raw'

let spellInstance = null
let isReady = false
let initPromise = null

export function initSpellingEngine() {
  if (isReady && spellInstance) {
    return Promise.resolve(spellInstance)
  }
  if (initPromise) {
    return initPromise
  }

  initPromise = Promise.resolve().then(() => {
    spellInstance = nspell({ aff, dic })
    isReady = true
    return spellInstance
  }).catch((error) => {
    initPromise = null
    console.error('[SpellingEngine] Dictionary load error:', error)
    throw error
  })

  return initPromise
}

/**
 * Checks a word and returns correctness flag along with top suggestions.
 * @param {string} word
 * @returns {{ isCorrect: boolean, suggestions: string[] }}
 */
export function checkWordSpelling(word) {
  if (!isReady || !spellInstance || !word || !word.trim()) {
    return { isCorrect: true, suggestions: [] }
  }

  const clean = word.trim().toLowerCase()
  
  // Allow single letter words or skip validation if numeric/special characters
  if (!/^[a-zA-Z]+$/.test(clean)) {
    return { isCorrect: false, suggestions: [] }
  }

  const isCorrect = spellInstance.correct(clean)
  if (isCorrect) {
    return { isCorrect: true, suggestions: [] }
  }

  const raw = spellInstance.suggest(clean) || []
  const suggestions = raw.slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1))

  return {
    isCorrect: false,
    suggestions
  }
}