import React, { useState, useEffect, useRef } from 'react';
import { Filter } from 'bad-words';
import { createGameSocket } from '../utils/socket';
import { playHDVoice } from '../utils/voiceEngine';
import { playMatchStartSound, playWinSound, playLossSound, playClickSound } from '../utils/soundFX';
import { initSpellingEngine, checkWordSpelling } from '../utils/spellingEngine';
import './BattleArena.css';

const profanityFilter = new Filter();

function isBlockedWord(word) {
  const value = String(word || '').trim().toLowerCase();
  const lettersOnly = value.replace(/[^a-z]/g, '');

  return profanityFilter.isProfane(value) || (lettersOnly && profanityFilter.isProfane(lettersOnly));
}

export default function BattleArena({ user, gameProfile, setGameProfile, onExit }) {
  const [stage, setStage] = useState('searching'); // searching | clash | starting | playing | solving | finished | error
  const [matchData, setMatchData] = useState(null);
  const [round, setRound] = useState(1);
  const [inputVal, setInputVal] = useState('');
  const [activeAudioWord, setActiveAudioWord] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [startCountdown, setStartCountdown] = useState(3);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [matchmakingSeconds, setMatchmakingSeconds] = useState(15);

  // Dynamic Spelling Engine State
  const [isTypo, setIsTypo] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSpellcheckReady, setIsSpellcheckReady] = useState(false);

  const socketRef = useRef(null);
  const matchDataRef = useRef(null);

  useEffect(() => {
    matchDataRef.current = matchData;
  }, [matchData]);

  const myId = String(user?.uid || user?.id || '').trim();
  const myPhoto = user?.photoURL || gameProfile?.avatar_url || gameProfile?.photoURL || '';
  const myRank = gameProfile?.rank || 'E';
  const isAttacker = String(matchData?.attackerId || '').trim() === myId;
  const canSuggest = isAttacker && stage === 'playing';

  const p1Name = matchData?.p1?.name || (matchData?.p1?.id === myId ? (gameProfile?.username || 'You') : 'Rival');
  const p2Name = matchData?.p2?.name || (matchData?.p2?.id === myId ? (gameProfile?.username || 'You') : 'Rival');

  const p1Photo = matchData?.p1?.photoURL || (matchData?.p1?.id === myId ? myPhoto : null);
  const p2Photo = matchData?.p2?.photoURL || (matchData?.p2?.id === myId ? myPhoto : null);

  const p1Rank = matchData?.p1?.rank || (matchData?.p1?.id === myId ? myRank : 'E');
  const p2Rank = matchData?.p2?.rank || (matchData?.p2?.id === myId ? myRank : 'E');

  // Opponent resolution
  const opponent = String(matchData?.p1?.id).trim() === myId ? matchData?.p2 : matchData?.p1;
  const opponentName = opponent?.name || 'Rival Hunter';
  const opponentPhoto = opponent?.photoURL || '';
  const opponentRank = opponent?.rank || 'E';

  // 1. Preload Spelling Engine on Mount
  useEffect(() => {
    initSpellingEngine()
      .then(() => {
        setIsSpellcheckReady(true);
      })
      .catch((err) => {
        console.warn('[BattleArena] Spellcheck engine failed to load:', err);
      });
  }, []);

  useEffect(() => {
    if (!canSuggest || !isSpellcheckReady || !inputVal.trim()) {
      setIsTypo(false);
      setSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      const check = checkWordSpelling(inputVal);
      setIsTypo(!check.isCorrect);
      setSuggestions(check.suggestions);
    }, 250);

    return () => clearTimeout(timer);
  }, [canSuggest, inputVal, isSpellcheckReady]);

  // 2. Debounced Spellcheck Handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);

    if (!canSuggest || !val.trim() || !isSpellcheckReady) {
      setIsTypo(false);
      setSuggestions([]);
      return;
    }
  };

  const handleApplySuggestion = (word) => {
    playClickSound();
    setInputVal(word);
    setIsTypo(false);
    setSuggestions([]);
  };

  // 3. Socket Lifecycle & Event Handlers
  useEffect(() => {
    if (!myId) {
      setErrorMsg('Unable to identify your player account.');
      setStage('error');
      return undefined;
    }

    const socket = createGameSocket();
    socketRef.current = socket;

    const handleMatchFound = (data) => {
      const p1Id = String(data.p1.id).trim();
      const p2Id = String(data.p2.id).trim();

      if (p1Id !== myId && p2Id !== myId) return;

      setMatchData(data);
      setRound(data.round);
      setStage('clash');
    };

    const handleChallengeActive = (data) => {
      setActiveAudioWord(data.wordForTTS);
      setRound(data.round);
      setStage('solving');

      if (myId === String(data.defenderId).trim()) {
        handlePlayAudio(data.wordForTTS, true);
      }
    };

    const handleRoundTransition = (data) => {
      setRound(data.round);
      setMatchData((prev) =>
        prev ? { ...prev, attackerId: data.attackerId, defenderId: data.defenderId } : prev
      );
      setInputVal('');
      setIsTypo(false);
      setSuggestions([]);
      setActiveAudioWord('');
      setStage('playing');
    };

    const handleBattleFinished = (res) => {
      setResult(res);
      setStage('finished');

      const myGemDelta = String(res.p1Id).trim() === myId ? res.p1GemDelta : res.p2GemDelta;
      const myExpDelta = String(res.p1Id).trim() === myId ? res.p1ExpDelta : res.p2ExpDelta;

      if (myGemDelta === 20) {
        playWinSound();
      } else {
        playLossSound();
      }

      if (setGameProfile) {
        setGameProfile((prev) => ({
          ...prev,
          gems: Math.max(0, (prev?.gems || 0) + (myGemDelta - 10)),
          exp: Math.max(0, (prev?.exp || 0) + myExpDelta)
        }));
      }
    };

    const handleMatchError = (msg) => {
      setErrorMsg(msg);
      setStage('error');
    };

    socket.on('match_found', handleMatchFound);
    socket.on('challenge_active', handleChallengeActive);
    socket.on('round_transition', handleRoundTransition);
    socket.on('battle_finished', handleBattleFinished);
    socket.on('match_error', handleMatchError);

    socket.connect();

    socket.emit('join_matchmaking', {
      userId: myId,
      username: gameProfile?.username || user?.displayName || 'Hunter',
      photoURL: myPhoto,
      rank: myRank
    });

    return () => {
      socket.off('match_found', handleMatchFound);
      socket.off('challenge_active', handleChallengeActive);
      socket.off('round_transition', handleRoundTransition);
      socket.off('battle_finished', handleBattleFinished);
      socket.off('match_error', handleMatchError);
      socket.disconnect();
    };
  }, [myId, myPhoto, myRank, gameProfile?.username, user?.displayName, setGameProfile]);

  // Clash Audio Trigger & Transition to Countdown
  useEffect(() => {
    if (stage !== 'clash') return;

    playMatchStartSound();

    const timer = setTimeout(() => {
      setStartCountdown(3);
      setStage('starting');
    }, 2400);
    return () => clearTimeout(timer);
  }, [stage]);

  // Starting Countdown
  useEffect(() => {
    if (stage !== 'starting') return;
    if (startCountdown > 0) {
      const t = setTimeout(() => setStartCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setStage('playing');
    }
  }, [stage, startCountdown]);

  useEffect(() => {
    if (stage !== 'searching') return undefined;

    setMatchmakingSeconds(15);
    const timer = setInterval(() => {
      setMatchmakingSeconds((seconds) => {
        if (seconds <= 1) {
          socketRef.current?.emit('request_bot_matchmaking');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage]);

  const handlePlayAudio = (word, isSlow = false) => {
    if (!word) return;
    setIsPlayingAudio(true);
    const playback = playHDVoice(word, isSlow);
    if (!playback.ok) {
      setErrorMsg(playback.message);
    } else {
      setErrorMsg('');
    }
    setTimeout(() => setIsPlayingAudio(false), isSlow ? 1800 : 1200);
  };

  const handleSendChallenge = (e) => {
    e.preventDefault();
    const cleanWord = inputVal.trim();
    const currentRoomId = matchDataRef.current?.roomId || matchData?.roomId;

    if (!cleanWord || !currentRoomId || isTypo) return;

    if (isBlockedWord(cleanWord)) {
      setErrorMsg('⚠️ This word is not allowed. Please choose another word.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    socketRef.current?.emit('submit_challenge', {
      roomId: currentRoomId,
      word: cleanWord
    });
    setInputVal('');
    setIsTypo(false);
    setSuggestions([]);
  };

  const handleSendAnswer = (e) => {
    e.preventDefault();
    const cleanGuess = inputVal.trim();
    const currentRoomId = matchDataRef.current?.roomId || matchData?.roomId;

    if (!cleanGuess || !currentRoomId) return;

    if (isBlockedWord(cleanGuess)) {
      setErrorMsg('⚠️ This word is not allowed. Please choose another word.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    socketRef.current?.emit('submit_answer', {
      roomId: currentRoomId,
      guess: cleanGuess
    });
    setInputVal('');
    setIsTypo(false);
    setSuggestions([]);
  };

  // STAGE 1: Radar Search Screen
  if (stage === 'searching') {
    return (
      <div className="battle-arena-modal">
        <div className="arena-card text-center">
          <div className="arena-top-bar">
            <button type="button" onClick={onExit} className="arena-close-btn" title="Cancel">✕</button>
            <div className="arena-star-pill">💎 20 POT</div>
          </div>
          <div className="search-pulse"></div>
          <h2 className="arena-title">MATCHMAKING...</h2>
          <p className="arena-desc">Searching for an online opponent</p>
          <div className="matchmaking-status" aria-live="polite">
            <strong>{matchmakingSeconds}s</strong>
          </div>
          <button type="button" onClick={onExit} className="arena-btn-cancel">CANCEL</button>
        </div>
      </div>
    );
  }

  // STAGE 2: Banner Scroll Clash Intro Stage
  if (stage === 'clash') {
    return (
      <div className="battle-arena-modal clash-overlay banner-clash-screen">
        <div className="clash-split-backdrop">
          <div className="split-half side-red">
            <div className="speed-lines-red"></div>
          </div>
          <div className="split-half side-blue">
            <div className="speed-lines-blue"></div>
          </div>
        </div>

        <div className="banner-clash-container">
          <div className="cyber-clash-header">
            <span className="cyber-sub-title">RANKED ARENA DUEL</span>
            <div className="cyber-match-badge">MATCH #01 • 20 💎 POT</div>
            <div className="cyber-opening-status">
              {isAttacker ? 'YOU SEND THE FIRST WORD' : 'OPPONENT SENDS FIRST'}
            </div>
          </div>

          <div className="banner-duel-stage">
            {/* Player 1 (Red Banner) */}
            <div className="banner-fighter-column p1-column">
              <div className="scroll-rod">
                <span className="rod-knob left-knob"></span>
                <div className="rod-bar"></div>
                <span className="rod-knob right-knob"></span>
              </div>
              <div className="scroll-cloth red-cloth">
                <div className="cloth-inner">
                  <span className="banner-side-tag">WARRIOR 1</span>
                  <div className="banner-avatar-frame">
                    {p1Photo ? (
                      <img
                        src={p1Photo}
                        alt={p1Name}
                        className="banner-avatar-img"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="banner-avatar-char red-text">
                        {p1Name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="banner-player-name">{p1Name}</span>
                  <div className="banner-rank-tag red-rank">RANK {p1Rank}</div>
                </div>
              </div>
            </div>

            {/* Center Metallic VS Impact */}
            <div className="banner-vs-center">
              <div className="vs-flash-flare"></div>
              <div className="vs-spark-glow"></div>
              <div className="vs-emblem-text">VS</div>
            </div>

            {/* Player 2 (Blue Banner) */}
            <div className="banner-fighter-column p2-column">
              <div className="scroll-rod">
                <span className="rod-knob left-knob"></span>
                <div className="rod-bar"></div>
                <span className="rod-knob right-knob"></span>
              </div>
              <div className="scroll-cloth blue-cloth">
                <div className="cloth-inner">
                  <span className="banner-side-tag">WARRIOR 2</span>
                  <div className="banner-avatar-frame">
                    {p2Photo ? (
                      <img
                        src={p2Photo}
                        alt={p2Name}
                        className="banner-avatar-img"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="banner-avatar-char blue-text">
                        {p2Name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="banner-player-name">{p2Name}</span>
                  <div className="banner-rank-tag blue-rank">RANK {p2Rank}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STAGE 3: Error Screen
  if (stage === 'error') {
    return (
      <div className="battle-arena-modal">
        <div className="arena-card text-center">
          <div className="arena-top-bar">
            <button type="button" onClick={onExit} className="arena-close-btn" title="Close">✕</button>
          </div>
          <h2 className="arena-title error-text">BATTLE ERROR</h2>
          <p className="arena-desc">{errorMsg}</p>
          <button type="button" onClick={onExit} className="arena-btn-primary">BACK TO LOBBY</button>
        </div>
      </div>
    );
  }

  // STAGE 4: Starting Countdown Stage
  if (stage === 'starting') {
    return (
      <div className="battle-arena-modal starting-screen">
        <div className="arena-card text-center starting-card">
          <div className="starting-kicker">ONLINE MATCH READY</div>
          <div className="arena-round-tag">ROUND {round} • 1v1 DUEL</div>
          <div className="starting-title-row">
            <div>
              <h2 className="arena-title">{isAttacker ? 'YOU ATTACK FIRST' : 'YOU DEFEND FIRST'}</h2>
              <p className="arena-desc">Get ready to {isAttacker ? 'set a word' : 'listen & spell'}</p>
            </div>
            <div className="starting-countdown" aria-label={`Match starts in ${startCountdown}`}>
              {startCountdown}
            </div>
          </div>

          <div className="starting-profile-duel">
            <div className="starting-profile-card current-player-card">
              <div className="starting-profile-avatar">
                {myPhoto ? <img src={myPhoto} alt={gameProfile?.username || 'Your profile'} /> : <span>{(gameProfile?.username || 'Y').charAt(0).toUpperCase()}</span>}
              </div>
              <div className="starting-profile-copy">
                <span className="starting-profile-label">YOUR PROFILE</span>
                <strong>{gameProfile?.username || user?.displayName || 'You'}</strong>
                <span className="starting-rank-pill">RANK {myRank}</span>
              </div>
            </div>

            <span className="starting-vs-mark">VS</span>

            <div className="starting-profile-card opponent-player-card">
              <div className="starting-profile-avatar">
                {opponentPhoto ? <img src={opponentPhoto} alt={opponentName} /> : <span>{opponentName.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="starting-profile-copy">
                <span className="starting-profile-label">OPPONENT</span>
                <strong>{opponentName}</strong>
                <span className="starting-rank-pill">RANK {opponentRank}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STAGE 5: Match Result Screen with Comparative Duel Profile Bar
  if (stage === 'finished') {
    const isP1 = String(result?.p1Id).trim() === myId;
    const myGemDelta = isP1 ? result?.p1GemDelta : result?.p2GemDelta;
    const myExpDelta = isP1 ? result?.p1ExpDelta : result?.p2ExpDelta;
    const isWin = myGemDelta === 20;
    const isDraw = myGemDelta === 10;

    const outcomeClass = isWin ? 'win-theme' : isDraw ? 'draw-theme' : 'lose-theme';
    const statusLabel = isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';
    const statusIcon = isWin ? '🏆' : isDraw ? '⚖️' : '💀';

    const myProfileData = isP1 ? matchData?.p1 : matchData?.p2;
    const oppProfileData = isP1 ? matchData?.p2 : matchData?.p1;

    const myDisplayName = myProfileData?.name || gameProfile?.username || 'You';
    const myDisplayPhoto = myProfileData?.photoURL || myPhoto;
    const myDisplayRank = myProfileData?.rank || myRank;

    const oppDisplayName = oppProfileData?.name || opponentName;
    const oppDisplayPhoto = oppProfileData?.photoURL || opponentPhoto;
    const oppDisplayRank = oppProfileData?.rank || opponentRank;

    return (
      <div className="battle-arena-modal result-overlay">
        <div className={`arena-card result-summary-card ${outcomeClass}`}>
          {/* Top Status Capsule */}
          <div className="result-top-status-bar">
            <div className="result-header-badge">
              <span className="result-pulse-dot"></span>
              BATTLE CONCLUDED • 1v1
            </div>
            <button type="button" onClick={onExit} className="arena-close-btn" title="Exit">✕</button>
          </div>

          {/* Combatants Profile Duel Bar */}
          <div className="result-versus-strip">
            {/* Player Profile */}
            <div className={`result-user-node ${isWin ? 'winner-node' : ''}`}>
              <div className="result-avatar-ring">
                {myDisplayPhoto ? (
                  <img src={myDisplayPhoto} alt={myDisplayName} className="result-avatar-img" />
                ) : (
                  <span className="result-avatar-char">{myDisplayName.charAt(0).toUpperCase()}</span>
                )}
                <span className="result-role-chip">{isWin ? 'WIN' : isDraw ? 'TIE' : 'LOST'}</span>
              </div>
              <span className="result-node-name">{myDisplayName}</span>
              <span className="result-rank-tag">RANK {myDisplayRank}</span>
            </div>

            {/* Central Divider */}
            <div className="result-vs-divider">
              <span className="result-vs-label">VS</span>
            </div>

            {/* Opponent Profile */}
            <div className={`result-user-node ${!isWin && !isDraw ? 'winner-node' : ''}`}>
              <div className="result-avatar-ring">
                {oppDisplayPhoto ? (
                  <img src={oppDisplayPhoto} alt={oppDisplayName} className="result-avatar-img" />
                ) : (
                  <span className="result-avatar-char">{oppDisplayName.charAt(0).toUpperCase()}</span>
                )}
                <span className="result-role-chip opp-chip">
                  {!isWin && !isDraw ? 'WIN' : isDraw ? 'TIE' : 'LOST'}
                </span>
              </div>
              <span className="result-node-name">{oppDisplayName}</span>
              <span className="result-rank-tag opp-rank">RANK {oppDisplayRank}</span>
            </div>
          </div>

          {/* Big Outcome Banner */}
          <div className="result-banner-center">
            <div className="result-trophy-emblem">
              <span className="trophy-emoji">{statusIcon}</span>
              <div className="trophy-glow-halo"></div>
            </div>
            <h2 className="cyber-result-title">{statusLabel}</h2>
            <p className="result-sub-desc">
              {isWin
                ? 'Flawless execution! You claimed the entire battle pot.'
                : isDraw
                ? 'Evenly matched combatants! Gem stakes refunded.'
                : 'Defeated in battle. Analyze your errors and return stronger.'}
            </p>
          </div>

          {/* Reward Badges */}
          <div className="result-rewards-container">
            <div className={`reward-box ${myGemDelta >= 10 ? 'reward-positive' : 'reward-negative'}`}>
              <span className="reward-type-label">VAULT GEMS</span>
              <div className="reward-value-row">
                <span className="reward-icon">💎</span>
                <span className="reward-amount">
                  {myGemDelta > 10 ? `+${myGemDelta}` : myGemDelta === 10 ? 'REFUND 10' : '-10'}
                </span>
              </div>
              <span className="reward-subtext">
                {myGemDelta > 10 ? 'NET +10 GEMS' : myGemDelta === 10 ? '0 NET LOSS' : 'LOST WAGER'}
              </span>
            </div>

            <div className={`reward-box ${myExpDelta >= 0 ? 'reward-positive' : 'reward-negative'}`}>
              <span className="reward-type-label">WARRIOR EXP</span>
              <div className="reward-value-row">
                <span className="reward-icon">⚡</span>
                <span className="reward-amount">
                  {myExpDelta >= 0 ? `+${myExpDelta}` : `${myExpDelta}`}
                </span>
              </div>
              <span className="reward-subtext">
                {myExpDelta >= 0 ? 'PROGRESSION' : 'RANK PENALTY'}
              </span>
            </div>
          </div>

          {/* Combat Intel Log */}
          <div className="cyber-word-intel-board">
            <div className="intel-board-title">COMBAT SPELL LOG</div>

            <div className="intel-round-row">
              <div className="intel-round-tag">R1</div>
              <div className="intel-details">
                <div className="intel-word-line">
                  <span className="intel-label">CHALLENGE:</span>
                  <strong className="intel-target-word">{result?.r1Word || '—'}</strong>
                </div>
                <div className="intel-word-line">
                  <span className="intel-label">SPELLING:</span>
                  <em className="intel-guess-word">"{result?.r1Guess || '—'}"</em>
                </div>
              </div>
            </div>

            <div className="intel-round-row">
              <div className="intel-round-tag">R2</div>
              <div className="intel-details">
                <div className="intel-word-line">
                  <span className="intel-label">CHALLENGE:</span>
                  <strong className="intel-target-word">{result?.r2Word || '—'}</strong>
                </div>
                <div className="intel-word-line">
                  <span className="intel-label">SPELLING:</span>
                  <em className="intel-guess-word">"{result?.r2Guess || '—'}"</em>
                </div>
              </div>
            </div>
          </div>

          {/* Action Exit Button */}
          <button type="button" onClick={onExit} className="arena-btn-primary result-cta-btn">
            CLAIM & RETURN TO LOBBY
          </button>
        </div>
      </div>
    );
  }

  // STAGE 6: Active Turn Gameplay with Opponent Profile HUD
  return (
    <div className="battle-arena-modal">
      <div className="arena-card battle-play-card">
        {/* Top Control Bar */}
        <div className="arena-top-bar">
          <button type="button" onClick={onExit} className="arena-close-btn" title="Leave Duel">✕</button>

          <div className="arena-progress-track">
            <div className={`track-seg ${round >= 1 ? 'active' : ''}`}></div>
            <div className={`track-seg ${round >= 2 ? 'active' : ''}`}></div>
          </div>

          <div className="arena-star-pill">
            ★ {round}/2
          </div>
        </div>

        {/* Player and opponent profile combat strip */}
        <div className="opponent-combat-strip">
          <div className="self-combat-profile">
            <div className="self-avatar-wrap">
              {myPhoto ? <img src={myPhoto} alt={gameProfile?.username || 'Your profile'} /> : <span>{(gameProfile?.username || 'Y').charAt(0).toUpperCase()}</span>}
            </div>
            <span className="self-profile-label">YOU</span>
            <strong>RANK {myRank}</strong>
          </div>

          <div className="combat-vs-divider">VS</div>

          <div className="opponent-avatar-wrap">
            {opponentPhoto ? (
              <img
                src={opponentPhoto}
                alt={opponentName}
                className="opponent-avatar-img"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span className="opponent-avatar-char">{opponentName.charAt(0).toUpperCase()}</span>
            )}
            <span className="opponent-pulse-ring"></span>
          </div>

          <div className="opponent-meta-col">
            <div className="opponent-name-row">
              <span className="opponent-target-label">VS OPPONENT</span>
              <h3 className="opponent-display-name">{opponentName}</h3>
            </div>
            <div className="opponent-badge-row">
              <span className="opponent-rank-pill">RANK {opponentRank}</span>
              <span className="opponent-role-pill">
                {isAttacker ? 'DEFENDING' : 'ATTACKING'}
              </span>
            </div>
          </div>
        </div>

        {/* Round Pill Badge & Turn Info */}
        <div className="arena-center-badge">
          <span className="arena-round-tag">ROUND {round} • 1v1 DUEL</span>
        </div>

        <div className="arena-sub-info">
          <span className="word-step">ROUND {round} OF 2</span>
          <span className="xp-run">+5 EXP REWARD</span>
        </div>

        <p className="arena-instruction">
          {isAttacker
            ? (stage === 'playing' ? 'Type a secret word for your opponent to spell' : 'Waiting for opponent to spell...')
            : (stage === 'solving' ? 'Listen to HD pronunciation and spell the word' : 'Opponent is choosing a challenge word...')}
        </p>

        {errorMsg && (
          <div className="arena-error-banner">
            {errorMsg}
          </div>
        )}

        {/* Active Combat Forms & Actions */}
        {isAttacker ? (
          stage === 'playing' ? (
            <form onSubmit={handleSendChallenge} className="arena-form">
              <div className="attacker-icon-zone">
                <div className="attacker-sword-icon">⚔️</div>
                <span className="attacker-label">SECRET WORD</span>
              </div>

              <div className="arena-input-wrapper relative">
                <input
                  type="text"
                  autoFocus
                  value={inputVal}
                  onChange={handleInputChange}
                  placeholder="Type secret word..."
                  className={`arena-input ${isTypo ? 'arena-input-error' : ''}`}
                  maxLength={20}
                />
                {isTypo && <span className="arena-input-status-icon">❌</span>}
              </div>

              {/* Suggestions */}
              {isTypo && suggestions.length > 0 && (
                <div className="arena-suggestions-container">
                  <span className="suggestions-title">SUGGESTIONS:</span>
                  <div className="suggestions-list">
                    {suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleApplySuggestion(sug)}
                        className="suggestion-chip-btn"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!inputVal.trim() || isTypo}
                className="arena-btn-primary"
              >
                {isTypo ? 'INVALID WORD' : 'SEND CHALLENGE'}
              </button>
            </form>
          ) : (
            <div className="arena-waiting-box">
              <div className="waiting-spinner"></div>
              <p className="waiting-text">{opponentName} is listening & spelling...</p>
            </div>
          )
        ) : (
          stage === 'playing' ? (
            <div className="arena-waiting-box">
              <div className="waiting-spinner"></div>
              <p className="waiting-text">{opponentName} is choosing a challenge word...</p>
            </div>
          ) : (
            <form onSubmit={handleSendAnswer} className="arena-form">
              <div className="audio-control-group">
                <button
                  type="button"
                  onClick={() => handlePlayAudio(activeAudioWord, false)}
                  className={`arena-speaker-btn ${isPlayingAudio ? 'playing' : ''}`}
                >
                  <div className="soundwave-bars">
                    <span></span><span></span><span></span><span></span>
                  </div>
                  <span className="speaker-text">PLAY HD</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayAudio(activeAudioWord, true)}
                  className="arena-slow-badge"
                >
                  🐢 Slow 0.7x
                </button>
              </div>

              <div className="arena-input-wrapper relative">
                <input
                  type="text"
                  autoFocus
                  value={inputVal}
                  onChange={handleInputChange}
                  placeholder="Type spelling here..."
                  className="arena-input"
                  maxLength={20}
                />
              </div>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="arena-btn-primary"
              >
                CHECK SPELLING
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}