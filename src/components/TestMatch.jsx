import React, { useState, useEffect, useRef } from 'react'
import { getRandomTestWords, saveUserSeenWords } from '../utils/wordEngine'
import { playHDVoice } from '../utils/voiceEngine'
import { updateProfileStats } from '../supabase'
import './TestMatch.css'

export default function TestMatch({ user, gameProfile, setGameProfile, wordBank = [], onExit }) {
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [score, setScore] = useState(0)
  const [answerHistory, setAnswerHistory] = useState([]) // tracks boolean per question for graph
  const [mistakes, setMistakes] = useState([])
  const [isCompleted, setIsCompleted] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [isVoicePlaying, setIsVoicePlaying] = useState(false)
  const sessionRef = useRef({ storageKey: '', seenWords: new Set() })

  const userId = user?.uid || 'guest'

  useEffect(() => {
    if (wordBank.length > 0) {
      const { selected, storageKey, seenWords } = getRandomTestWords(wordBank, userId)
      sessionRef.current = { storageKey, seenWords }
      setQuestions(selected)
    }
  }, [wordBank, userId])

  const currentWord = questions[currentIndex] || ''

  const triggerVoice = (slow = false) => {
    if (!currentWord) return
    setIsVoicePlaying(true)
    playHDVoice(currentWord, slow)
    setTimeout(() => setIsVoicePlaying(false), 1100)
  }

  useEffect(() => {
    if (currentWord && !isCompleted) {
      triggerVoice(false)
    }
  }, [currentIndex, currentWord, isCompleted])

  const handleAnswerSubmit = async (e) => {
    e.preventDefault()
    if (!inputVal.trim() || isEvaluating) return

    setIsEvaluating(true)
    const isCorrect = inputVal.trim().toLowerCase() === currentWord.toLowerCase()

    setAnswerHistory((prev) => [...prev, isCorrect])

    if (isCorrect) {
      setFeedback('correct')
      setScore((prev) => prev + 1)
    } else {
      setFeedback('wrong')
      setMistakes((prev) => [...prev, { word: currentWord, userTyped: inputVal.trim() }])
    }

    setTimeout(async () => {
      setFeedback(null)
      setInputVal('')
      setIsEvaluating(false)

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        const finalScore = score + (isCorrect ? 1 : 0)
        await finalizeMatch(finalScore)
      }
    }, 700)
  }

  const finalizeMatch = async (finalScore) => {
    setIsCompleted(true)
    saveUserSeenWords(sessionRef.current.storageKey, sessionRef.current.seenWords, questions)

    // EXP Formula: 2 correct = 1 EXP | 4 correct = 2 EXP
    let earnedExp = 0
    if (finalScore >= 4) earnedExp = 2
    else if (finalScore >= 2) earnedExp = 1

    // Gem Formula: 2-3 correct = 1 Gem | 4 correct = 3 Gems
    let earnedGems = 0
    if (finalScore >= 4) earnedGems = 3
    else if (finalScore >= 2) earnedGems = 1

    if ((earnedExp > 0 || earnedGems > 0) && !user?.isGuest && user?.uid) {
      const newExp = (gameProfile?.exp || 0) + earnedExp
      const newGems = (gameProfile?.gems || 0) + earnedGems

      const updated = await updateProfileStats(user.uid, { exp: newExp, gems: newGems })
      if (updated) {
        setGameProfile(updated)
      }
    }
  }

  // Emotion & Title Resolver
  const getEmotionBanner = (finalScore) => {
    if (finalScore === 4) {
      return {
        title: 'GODLIKE ACCURACY!',
        subtitle: 'Flawless spelling round! Master tier intuition.',
        badge: '👑 SUPREME',
        color: '#facc15',
        exp: 2,
        gems: 3
      }
    }
    if (finalScore >= 2) {
      return {
        title: 'VICTORY SECURED!',
        subtitle: 'Solid performance! Your vocabulary is climbing fast.',
        badge: '⚡ SHARP',
        color: '#4ade80',
        exp: finalScore >= 4 ? 2 : 1,
        gems: finalScore >= 4 ? 3 : 1
      }
    }
    return {
      title: 'KEEP YOUR FOCUS!',
      subtitle: 'Mistakes build champions. Re-listen and strike back!',
      badge: '🔥 RESILIENT',
      color: '#f87171',
      exp: 0,
      gems: 0
    }
  }

  const emotion = getEmotionBanner(score)
  const accuracyPct = Math.round((score / 4) * 100)

  return (
    <div className="test-arena-overlay">
      <div className="test-arena-stars" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div className="test-arena-window">
        {/* Top Navigation */}
        <header className="test-top-bar">
          <button type="button" onClick={onExit} className="test-close-icon">✕</button>
          
          <div className="test-stepper-track">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`test-step-node ${
                  idx < currentIndex ? 'done' : idx === currentIndex ? 'active' : ''
                }`}
              />
            ))}
          </div>

          <div className="test-score-counter" aria-label={`Score ${score} out of 4`}>
            <span className="score-star">★</span> {score}/4
          </div>
        </header>

        {!isCompleted ? (
          <main key={`question-${currentIndex}`} className="test-card-content question-enter">
            <div className="test-badge-pill">ROUND 1 • 4 WORDS</div>
            <div className="test-question-meta">
              <span>WORD {currentIndex + 1} OF {questions.length || 4}</span>
              <span className="test-xp-hint">+250 XP RUN</span>
            </div>
            <p className="test-mission-sub">Listen to HD pronunciation and spell the word</p>

            {/* Audio Station */}
            <div className="test-audio-dock">
              <button
                type="button"
                onClick={() => triggerVoice(false)}
                className={`test-speaker-main ${feedback || ''} ${isVoicePlaying ? 'speaking' : ''}`}
                title="Normal Speed"
              >
                <div className="audio-soundwaves">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </div>
                <span className="speaker-sub">{isVoicePlaying ? 'Playing...' : 'Play HD'}</span>
              </button>

              <button
                type="button"
                onClick={() => triggerVoice(true)}
                className="test-speaker-slow"
                title="Slow Speed"
              >
                🐢 Slow 0.7x
              </button>
            </div>

            {/* Input submission */}
            <form onSubmit={handleAnswerSubmit} className="test-input-group">
              <input
                type="text"
                autoFocus
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type spelling here..."
                disabled={isEvaluating}
                className="test-text-input"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              
              <button
                type="submit"
                disabled={!inputVal.trim() || isEvaluating}
                className="test-confirm-btn"
              >
                CHECK SPELLING
              </button>
            </form>
          </main>
        ) : (
          /* Post-Match Analytics & Performance Graph */
          <main className="test-summary-content result-enter">
            <div className="test-emotion-badge" style={{ borderColor: emotion.color, color: emotion.color }}>
              {emotion.badge}
            </div>

            <h2 className="test-victory-title" style={{ color: emotion.color }}>
              {emotion.title}
            </h2>
            <p className="test-emotion-desc">{emotion.subtitle}</p>

            {/* Visual Performance Graph */}
            <div className="test-analytics-card">
              <div className="analytics-header">
                <span>ACCURACY RADAR</span>
                <span className="accuracy-val">{accuracyPct}%</span>
              </div>

              {/* 4-Stage Step Bar Graph */}
              <div className="test-round-graph">
                {answerHistory.map((isHit, i) => (
                  <div key={i} className="graph-col">
                    <div className={`graph-bar ${isHit ? 'hit' : 'miss'}`}>
                      <span>{isHit ? '✓' : '✕'}</span>
                    </div>
                    <span className="graph-label">W{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reward Badges */}
            <div className="test-reward-card">
              <div className="reward-chip exp">+{emotion.exp} EXP</div>
              <div className="reward-chip gem">💎 +{emotion.gems} GEMS</div>
            </div>

            {mistakes.length > 0 && (
              <div className="test-error-log">
                <span className="error-log-header">Review Mistakes:</span>
                {mistakes.map((m, i) => (
                  <div key={i} className="error-item">
                    <span className="word-target">{m.word}</span>
                    <span className="word-typed">Your spell: "{m.userTyped}"</span>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={onExit} className="test-finish-btn">
              CLAIM & RETURN
            </button>
          </main>
        )}
      </div>
    </div>
  )
}