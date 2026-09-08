export function getRandomTestWords(wordBank = [], userId = 'guest') {
  const storageKey = `seen_words_all_${userId}`

  let seenWords = new Set()
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) seenWords = new Set(JSON.parse(raw))
  } catch (err) {
    console.error('History read error:', err)
  }

  // Filter non-seen words across all 8,000 entries
  let availablePool = wordBank.filter((item) => {
    if (!item?.headword) return false
    return !seenWords.has(item.headword.toLowerCase().trim())
  })

  // Auto-reset when the entire 8,000 dictionary is complete
  if (availablePool.length < 4) {
    availablePool = wordBank.filter((item) => Boolean(item?.headword))
    seenWords.clear()
    localStorage.removeItem(storageKey)
  }

  // True random Fisher-Yates shuffle
  const shuffled = [...availablePool].sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, 4).map((w) => w.headword.trim())

  return { selected, storageKey, seenWords }
}

export function saveUserSeenWords(storageKey, seenWordsSet, newWords = []) {
  try {
    newWords.forEach((w) => seenWordsSet.add(w.toLowerCase().trim()))
    localStorage.setItem(storageKey, JSON.stringify(Array.from(seenWordsSet)))
  } catch (err) {
    console.error('History save error:', err)
  }
}