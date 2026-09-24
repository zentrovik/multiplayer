import React, { useState, useRef, useEffect } from 'react'
import { updateProfileStats, calculateRankFromExp, RANK_TIERS } from '../supabase'
import { playClickSound, playWinSound } from '../utils/soundFX'
import TestMatch from './TestMatch'
import BattleArena from './BattleArena'
import wordsData from '../data/dataset.json'
import dashboardBg from '../assets/dashboard-bg.png'
import './Dashboard.css'

export default function Dashboard({ user, gameProfile, setGameProfile, onLogout }) {
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showGuestAlert, setShowGuestAlert] = useState(false)
  const [showAdModal, setShowAdModal] = useState(false)
  const [showBugReportModal, setShowBugReportModal] = useState(false)
  const [showRewardsGuide, setShowRewardsGuide] = useState(false)
  const [inTestMatch, setInTestMatch] = useState(false)
  const [inBattleArena, setInBattleArena] = useState(false)
  const [inputName, setInputName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [avatarLoaded, setAvatarLoaded] = useState(false)

  // Full-Screen Rewarded Ad States
  const [isPlayingAd, setIsPlayingAd] = useState(false)
  const [adCountdown, setAdCountdown] = useState(null)
  const [adCompleted, setAdCompleted] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [adLoading, setAdLoading] = useState(true)
  const [adProgress, setAdProgress] = useState(0)
  const [isClaimingReward, setIsClaimingReward] = useState(false)
  const videoRef = useRef(null)
  const adCloseRef = useRef(false)

  const username = gameProfile?.username || user?.displayName || 'Zentrovik'
  const exp = gameProfile?.exp ?? 0
  const gems = gameProfile?.gems ?? 100
  const rank = calculateRankFromExp(exp)
  const isGuest = Boolean(user?.isGuest)
  const avatarInitial = username.charAt(0).toUpperCase() || 'Z'
  const avatarUrl = user?.photoURL || gameProfile?.photo_url || gameProfile?.avatar_url || gameProfile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid || 'zentrovik'}`
  const rewardedAdUrl = `${import.meta.env.BASE_URL}rewarded-ad.mp4`

  const currentTier = RANK_TIERS.find((t) => t.rank === rank) || RANK_TIERS[0]
  const nextTargetExp = currentTier.nextExp
  const currentLevelExp = exp - currentTier.minExp
  const maxLevelExp = nextTargetExp ? nextTargetExp - currentTier.minExp : 100
  const progressPercent = nextTargetExp
    ? Math.min(100, Math.max(0, (currentLevelExp / maxLevelExp) * 100))
    : 100

  const isDefaultName =
    !gameProfile?.username ||
    gameProfile.username === 'Shadow Warrior' ||
    gameProfile.username === 'Guest Warrior'

  useEffect(() => {
    setAvatarFailed(false)
    setAvatarLoaded(false)
  }, [user?.uid, avatarUrl])

  useEffect(() => {
    if (!isPlayingAd) return undefined

    const video = videoRef.current
    if (!video) return undefined

    const startVideo = () => {
      video.play().catch(() => {
        setAdLoading(true)
      })
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && !video.ended) {
        startVideo()
      }
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      startVideo()
    } else {
      video.addEventListener('loadedmetadata', startVideo, { once: true })
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      video.removeEventListener('loadedmetadata', startVideo)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isPlayingAd])

  const handleRankMatchClick = () => {
    if (isGuest) {
      setShowGuestAlert(true)
      return
    }
    setInBattleArena(true)
  }

  const handleSaveUsername = async (e) => {
    e.preventDefault()
    const trimmed = inputName.trim()
    if (!trimmed) return

    setIsSaving(true)
    try {
      setGameProfile((prev) => (prev ? { ...prev, username: trimmed } : { username: trimmed }))
      if (!isGuest && user?.uid) {
        await updateProfileStats(user.uid, { username: trimmed })
      }
    } catch (err) {
      console.error('Save username error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Trigger Fullscreen Ad
  const handleWatchAd = () => {
    playClickSound()
    adCloseRef.current = false
    setIsClaimingReward(false)
    setIsPlayingAd(true)
    setAdCompleted(false)
    setAdCountdown(null)
    setVideoError(false)
    setAdLoading(true)
    setAdProgress(0)
  }

  const handleBugReportMail = () => {
    playClickSound()
    const bugEmail = 'zentrovik.team@gmail.com'
    const subject = encodeURIComponent('Bug Finder Reward Proof')
    const body = encodeURIComponent(
      'Hello Zentrovik Team,\n\nI found a bug in the game and attached proof below.\n\nPlease verify the bug and reward the correct finder.\n\nBug Details:\n[Describe the bug]\n\nProof:\n[Attach screenshot, screen recording, or test steps]\n\nThanks,'
    )
    window.location.href = `mailto:${bugEmail}?subject=${subject}&body=${body}`
    setShowBugReportModal(false)
  }

  const handleVideoLoaded = (event) => {
    const duration = event.currentTarget.duration
    if (Number.isFinite(duration) && duration > 0) {
      setAdCountdown(Math.ceil(duration))
    }
    setAdLoading(false)
  }

  const handleVideoProgress = (event) => {
    const video = event.currentTarget
    if (!video.ended && Number.isFinite(video.duration)) {
      setAdCountdown(Math.max(0, Math.ceil(video.duration - video.currentTime)))
      setAdProgress(Math.min(100, (video.currentTime / video.duration) * 100))
    }
  }

  const handleVideoPlaying = () => setAdLoading(false)

  const handleVideoCanPlay = (event) => {
    setAdLoading(false)
    event.currentTarget.play().catch(() => {
      setAdLoading(true)
    })
  }

  // The media event is the only path that unlocks the reward.
  const handleVideoEnded = () => {
    setAdCountdown(0)
    setAdProgress(100)
    setAdLoading(false)
    setAdCompleted(true)
    playWinSound()
  }

  const closeAd = () => {
    adCloseRef.current = true
    setIsPlayingAd(false)
    setAdCompleted(false)
    setAdCountdown(null)
    setVideoError(false)
    setAdLoading(false)
    setAdProgress(0)
    setIsClaimingReward(false)
    setShowAdModal(false)
  }

  // Claim Reward after Ad Finish
  const handleClaimReward = () => {
    if (isClaimingReward || !adCompleted) return

    playClickSound()
    setIsClaimingReward(true)
    const newGems = (gameProfile?.gems || 0) + 4
    setGameProfile((prev) => (prev ? { ...prev, gems: newGems } : { gems: newGems }))
    closeAd()

    if (!isGuest && user?.uid) {
      updateProfileStats(user.uid, { gems: newGems }).catch((error) => {
        console.error('Save rewarded gems error:', error)
      })
    }
  }

  return (
    <div 
      className="space-viewport" 
      style={{ backgroundImage: `url(${dashboardBg})` }}
    >
      <div className="space-backdrop-overlay"></div>

      <div 
        className="space-frame"
        style={{ backgroundImage: `url(${dashboardBg})` }}
      >
        <div className="space-frame-overlay"></div>

        {/* Top Header */}
        <header className="space-header">
          <div className="space-title-badge">
            <div className="space-hex-icon" onClick={() => setShowProfileModal(true)}>
              <span>{rank === 'God Mode' ? 'GOD' : rank}</span>
            </div>
            <div className="space-badge-content">
              <div className="space-badge-sub">
                <span>HUNTER</span>
                <span className="space-rarity-tag">RARE+</span>
              </div>
              <h1 className="space-badge-name">{username}</h1>
            </div>
          </div>

          {/* Gem Display with Plus Button */}
          <div className="space-gem-container">
            <div className="space-gem-display">
              <span className="space-gem-icon">💎</span>
              <span className="space-gem-val">{Number(gems).toLocaleString()}</span>
            </div>
            <button 
              type="button" 
              className="space-gem-plus-btn"
              onClick={() => setShowAdModal(true)}
              title="Recharge Gems"
            >
              +
            </button>
            <button
              type="button"
              className="space-bug-report-btn"
              onClick={() => setShowBugReportModal(true)}
              title="Bug Finder Reward"
            >
              <span className="space-bug-report-icon">?</span>
            </button>
            <button
              type="button"
              className="space-help-btn"
              onClick={() => setShowRewardsGuide(true)}
              title="How rewards work"
              aria-label="How rewards work"
            >
              <span aria-hidden="true">i</span>
            </button>
          </div>
        </header>

        {/* Hero Character Stage */}
        <main className="space-hero-arena">
          <div className="space-buff-text">
            <span>EXP +{exp}</span>
            <span className="buff-sub">RANK {rank}</span>
          </div>

          <div className="space-character-wrapper">
            <div className="space-char-display">
              <div className="space-avatar-fallback" aria-hidden="true">
                {avatarInitial}
              </div>
              {!avatarFailed && avatarLoaded && (
                <img
                  src={avatarUrl}
                  alt={`${username} profile`}
                  className="space-char-img"
                  onLoad={() => setAvatarLoaded(true)}
                  onError={() => {
                    setAvatarFailed(true)
                    setAvatarLoaded(false)
                  }}
                />
              )}
              {!avatarFailed && !avatarLoaded && (
                <img
                  src={avatarUrl}
                  alt=""
                  aria-hidden="true"
                  className="space-char-img space-char-img-preload"
                  onLoad={() => setAvatarLoaded(true)}
                  onError={() => setAvatarFailed(true)}
                />
              )}
            </div>
            <div className="space-char-shadow"></div>
          </div>
        </main>

        {/* Stats Capsules */}
        <section className="space-stats-section">
          <div className="space-capsule-row">
            <div className="space-stat-pill exp-pill">
              <span className="stat-pill-icon">👊</span>
              <span className="stat-pill-val">{exp} EXP</span>
            </div>

            <div className="space-stat-pill lv-pill" onClick={() => setShowProfileModal(true)}>
              <span className="lv-badge">LV</span>
              <span className="lv-val">{rank}</span>
            </div>
          </div>
        </section>

        {/* Default Name Setup Box */}
        {isDefaultName && (
          <div className="space-name-box">
            <form onSubmit={handleSaveUsername} className="space-name-form">
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Set Hunter Name..."
                maxLength={14}
                className="space-name-input"
              />
              <button
                type="submit"
                disabled={isSaving || !inputName.trim()}
                className="space-name-btn"
              >
                {isSaving ? '...' : 'SAVE'}
              </button>
            </form>
          </div>
        )}

        {/* Action Footer */}
        <footer className="space-action-footer">
          <button
            type="button"
            onClick={handleRankMatchClick}
            className={`space-btn-primary ${isGuest ? 'space-btn-locked' : ''}`}
          >
            <span className="space-btn-icon">⚔️</span>
            <span className="space-btn-text">
              {isGuest ? 'RANK MATCH 🔒' : 'RANK MATCH (10 💎)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInTestMatch(true)}
            className="space-btn-secondary"
          >
            TEST MATCH
          </button>
        </footer>

        {/* ------------------------------------------------------------- */}
        {/* REWARDED AD SYSTEM: PROMPT MODAL + FULLSCREEN PLAYBACK OVERLAY */}
        {/* ------------------------------------------------------------- */}
        {showAdModal && (
          <>
            {!isPlayingAd ? (
              // Prompt Sheet
              <div className="space-modal-overlay" onClick={() => setShowAdModal(false)}>
                <div className="space-modal-sheet ad-modal-sheet" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setShowAdModal(false)}
                    className="space-modal-close"
                  >
                    ✕
                  </button>
                  <div className="ad-modal-header">
                    <span className="ad-gem-large">💎</span>
                    <h3 className="ad-modal-title">GEM RECHARGE</h3>
                    <p className="ad-modal-desc">
                      Watch the complete video to recharge your gem vault.
                    </p>
                  </div>

                  <div className="ad-reward-card">
                    <span className="ad-reward-label">BROADCAST REWARD</span>
                    <span className="ad-reward-amount">+4 GEMS</span>
                    <span className="ad-reward-sub">⚡ Instant Crediting</span>
                  </div>

                  <button 
                    type="button" 
                    className="ad-watch-btn"
                    onClick={handleWatchAd}
                  >
                    📺 WATCH VIDEO (+4 💎)
                  </button>
                </div>
              </div>
            ) : (
              // Full-Screen Immersive Video Stage
              <div className="fullscreen-ad-modal" role="dialog" aria-modal="true" aria-label="Rewarded video">
                <button type="button" className="fullscreen-ad-close" onClick={closeAd} aria-label="Close video">
                  <span aria-hidden="true">&#10005;</span>
                </button>

                <div className="fullscreen-ad-topbar">
                  <div className={`ad-timer-pill ${adCompleted ? 'ad-timer-ready' : ''}`}>
                    <span className="ad-timer-dot"></span>
                    {adCompleted ? 'READY TO CLAIM' : adCountdown === null ? 'LOADING' : `${adCountdown}s`}
                  </div>
                </div>

                <div className="fullscreen-ad-content">
                  <div className={`fullscreen-video-wrapper ${adLoading ? 'is-loading' : ''}`}>
                  {!videoError ? (
                    <video
                      ref={videoRef}
                      src={rewardedAdUrl}
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      className="fullscreen-video-stream"
                      onLoadedMetadata={handleVideoLoaded}
                      onCanPlay={handleVideoCanPlay}
                      onPlaying={handleVideoPlaying}
                      onTimeUpdate={handleVideoProgress}
                      onEnded={handleVideoEnded}
                      onError={() => {
                        setVideoError(true)
                        setAdCountdown(null)
                        setAdCompleted(false)
                        setAdLoading(false)
                      }}
                      controls={false}
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      onContextMenu={(event) => event.preventDefault()}
                    />
                  ) : (
                    <div className="fullscreen-video-fallback">
                      <div className="fallback-cyber-core">
                        <div className="fallback-pulse-ring"></div>
                        <span className="fallback-icon">📡</span>
                      </div>
                      <h4 className="fallback-title">VIDEO UNAVAILABLE</h4>
                      <p className="fallback-desc">The reward cannot be claimed until the complete ad is watched.</p>
                      <button
                        type="button"
                        className="ad-retry-btn"
                        onClick={() => {
                          setIsPlayingAd(false)
                          setAdCountdown(null)
                          setVideoError(false)
                        }}
                      >
                        RETURN TO RECHARGE
                      </button>
                    </div>
                  )}

                  {adLoading && !videoError && (
                    <div className="ad-loading-state" aria-live="polite">
                      <span className="ad-loader-ring"></span>
                      <span>LOADING VIDEO...</span>
                    </div>
                  )}

                  <div className="fullscreen-frame-corner top-left"></div>
                  <div className="fullscreen-frame-corner top-right"></div>
                  <div className="fullscreen-frame-corner btm-left"></div>
                  <div className="fullscreen-frame-corner btm-right"></div>
                  </div>

                  <div className="ad-progress-track" aria-label={`${Math.round(adProgress)} percent watched`}>
                    <span style={{ width: `${adProgress}%` }}></span>
                  </div>
                  <div className="ad-progress-meta">
                    <span>{adCompleted ? 'Broadcast complete' : 'Keep this window open'}</span>
                    <span>{Math.round(adProgress)}%</span>
                  </div>
                </div>

                <div className="fullscreen-ad-footer">
                  {adCompleted ? (
                    <button 
                      type="button" 
                      className="fullscreen-claim-btn"
                      onClick={handleClaimReward}
                      disabled={isClaimingReward}
                    >
                      <span>{isClaimingReward ? 'SAVING...' : 'CLAIM REWARD'}</span>
                      <strong>+4 GEMS</strong>
                    </button>
                  ) : (
                    <div className="fullscreen-lock-notice">
                      <span>
                        🔒 {adCountdown === null ? 'Loading video...' : `Watch ${adCountdown}s to earn reward`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Profile / Tier Modal */}
        {showProfileModal && (
          <div className="arcade-modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="arcade-sunburst"></div>
            <div className="arcade-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="space-modal-close"
              >
                ✕
              </button>

              <div className="arcade-title-banner">
                <span className="arcade-title-text">RANK INFO</span>
              </div>

              <div className="arcade-badge-stage">
                <div className="laurel-leaf laurel-left"></div>
                <div className="arcade-hex-shield">
                  <div className="hex-shield-inner">
                    <span className="hex-rank-number">{rank === 'God Mode' ? 'GOD' : rank}</span>
                  </div>
                </div>
                <div className="laurel-leaf laurel-right"></div>
              </div>

              <h3 className="space-modal-uname">{username}</h3>
              <span className="space-modal-tier">TIER: {rank}</span>

              <div className="space-modal-exp-card">
                <div className="exp-card-header">
                  <span>TOTAL EXP</span>
                  <span className="exp-highlight">{exp} PTS</span>
                </div>
                <div className="exp-track">
                  <div className="exp-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <div className="exp-card-sub">
                  <span>Current: {rank}</span>
                  <span>{nextTargetExp ? `Next: ${nextTargetExp} EXP` : 'MAX LEVEL'}</span>
                </div>
              </div>

              <div className="space-modal-tiers">
                <div>E: 0 EXP</div>
                <div>D: 250 EXP</div>
                <div>C: 500 EXP</div>
                <div>B: 750 EXP</div>
                <div>A: 1000 EXP</div>
                <div>S: 1500 EXP</div>
                <div className="god-tier-cell">God Mode: 2000 EXP</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false)
                  onLogout()
                }}
                className="space-logout-btn"
              >
                LOGOUT
              </button>

              <p className="arcade-tap-continue" onClick={() => setShowProfileModal(false)}>
                TAP OUTSIDE TO CLOSE
              </p>
            </div>
          </div>
        )}

        {/* Guest Lock Alert */}
        {showBugReportModal && (
          <div className="space-modal-overlay" onClick={() => setShowBugReportModal(false)}>
            <div className="space-modal-sheet ad-modal-sheet bug-report-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowBugReportModal(false)}
                className="space-modal-close"
              >
                ✕
              </button>

              <div className="ad-modal-header">
                <span className="ad-gem-large">⚡</span>
                <h3 className="ad-modal-title">BUG FINDER REWARD</h3>
                <p className="ad-modal-desc">
                  Find the bug, send proof to the email below, and the team will verify the report and reward the correct finder.
                </p>
              </div>

              <div className="ad-reward-card bug-reward-card">
                <span className="ad-reward-label">REPORT EMAIL</span>
                <span className="bug-email-text">zentrovik.team@gmail.com</span>
                <span className="ad-reward-sub">SEND PROOF · VERIFY · BIG REWARD</span>
              </div>

              <button
                type="button"
                className="ad-watch-btn bug-report-send-btn"
                onClick={handleBugReportMail}
              >
                SEND BUG REPORT
              </button>
            </div>
          </div>
        )}

        {showRewardsGuide && (
          <div className="space-modal-overlay" onClick={() => setShowRewardsGuide(false)}>
            <div
              className="space-modal-sheet rewards-guide-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rewards-guide-title"
            >
              <button
                type="button"
                onClick={() => setShowRewardsGuide(false)}
                className="space-modal-close"
                aria-label="Close rewards guide"
              >
                ✕
              </button>

              <div className="rewards-guide-heading">
                <span className="rewards-guide-icon" aria-hidden="true">✦</span>
                <div>
                  <h3 id="rewards-guide-title">REWARDS GUIDE</h3>
                  <p>How Gems, EXP, and ranks work</p>
                </div>
              </div>

              <section className="rewards-guide-section">
                <div className="rewards-guide-section-title">
                  <span>🎧</span>
                  <strong>TEST MATCH</strong>
                  <small>4 words</small>
                </div>
                <div className="rewards-guide-row"><span>0-1 correct</span><b>+0 Gems · +0 EXP</b></div>
                <div className="rewards-guide-row"><span>2-3 correct</span><b className="guide-positive">+1 Gem · +1 EXP</b></div>
                <div className="rewards-guide-row"><span>4 correct</span><b className="guide-gold">+3 Gems · +2 EXP</b></div>
                <p className="rewards-guide-note">Finish the test, then tap <strong>CLAIM &amp; RETURN</strong> to save the reward.</p>
              </section>

              <section className="rewards-guide-section online-guide-section">
                <div className="rewards-guide-section-title">
                  <span>⚔️</span>
                  <strong>RANKED ONLINE</strong>
                  <small>10 Gem wager</small>
                </div>
                <div className="rewards-guide-row"><span>Win</span><b className="guide-positive">+10 net Gems · +5 EXP</b></div>
                <div className="rewards-guide-row"><span>Draw</span><b>10 Gems back · +5 EXP</b></div>
                <div className="rewards-guide-row"><span>Lose</span><b className="guide-negative">-10 Gems · -5 EXP</b></div>
                <p className="rewards-guide-note">The 10 Gems are locked to enter. A win pays 20 back, which is 10 Gems profit.</p>
              </section>

              <div className="rewards-guide-ranks">
                <span>RANKS</span>
                <strong>E 0</strong><strong>D 250</strong><strong>C 500</strong><strong>B 750</strong><strong>A 1,000</strong><strong>S 1,500</strong><strong>GOD 2,000 EXP</strong>
              </div>
            </div>
          </div>
        )}

        {showGuestAlert && (
          <div className="space-modal-overlay">
            <div className="space-modal-sheet space-alert-sheet">
              <div className="space-alert-icon">🔒</div>
              <h3 className="space-alert-title">Ranked Locked</h3>
              <p className="space-alert-body">
                Log in with Google to enter Ranked Battles and save your progress.
              </p>
              <div className="space-alert-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setShowGuestAlert(false)
                    onLogout()
                  }}
                  className="space-alert-login"
                >
                  LOG IN WITH GOOGLE
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuestAlert(false)}
                  className="space-alert-cancel"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Practice Test Bot */}
        {inTestMatch && (
          <TestMatch
            user={user}
            gameProfile={gameProfile}
            setGameProfile={setGameProfile}
            wordBank={wordsData}
            onExit={() => setInTestMatch(false)}
          />
        )}

        {/* Active Live 1v1 Online Battle */}
        {inBattleArena && (
          <BattleArena
            user={user}
            gameProfile={gameProfile}
            setGameProfile={setGameProfile}
            onExit={() => setInBattleArena(false)}
          />
        )}

      </div>
    </div>
  )
}