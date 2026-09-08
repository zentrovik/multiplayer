import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

// Socket.IO Server Configuration
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
})

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Error] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const WAGER_GEMS = 10
const MATCH_TIMEOUT_MS = 15000 // 15-second matchmaking limit
const BOT_RESPONSE_MIN_MS = 9500
const BOT_RESPONSE_VARIATION_MS = 2000
let matchmakingQueue = []
const activeRooms = new Map()
let isMatching = false

// --------------------------------------------------------------------------
// 1. DATASET & BOT ASSET LOADERS
// --------------------------------------------------------------------------
const NAMES_FILE_PATH = path.join(__dirname, '../src/data/names.json')
const DATASET_FILE_PATH = path.join(__dirname, '../src/data/dataset.json')

let botNamesList = ['Shadow', 'Viper', 'Nova', 'Blaze', 'Frost', 'Echo', 'Raven', 'Hunter']
try {
  if (fs.existsSync(NAMES_FILE_PATH)) {
    const rawNames = JSON.parse(fs.readFileSync(NAMES_FILE_PATH, 'utf-8'))
    if (Array.isArray(rawNames) && rawNames.length > 0) {
      botNamesList = rawNames
    }
  }
} catch (err) {
  console.warn('[Bot Data] Failed to load names.json, using fallback list:', err.message)
}

let botWordPool = [
  'apple', 'beach', 'cloud', 'flame', 'grape', 'house', 'light', 'plant',
  'river', 'space', 'tiger', 'water', 'earth', 'storm', 'stone', 'sword'
]
try {
  if (fs.existsSync(DATASET_FILE_PATH)) {
    const rawData = JSON.parse(fs.readFileSync(DATASET_FILE_PATH, 'utf-8'))
    if (Array.isArray(rawData) && rawData.length > 0) {
      const extracted = rawData
        .map((entry) => (typeof entry === 'string' ? entry : entry.headword || entry.word))
        .filter((w) => w && /^[a-zA-Z]{4,6}$/.test(w.trim()))
        .map((w) => w.trim().toLowerCase())

      if (extracted.length > 0) {
        botWordPool = extracted
      }
    }
  }
} catch (err) {
  console.warn('[Bot Data] Failed to load dataset.json, using fallback pool:', err.message)
}

// --------------------------------------------------------------------------
// 2. BOT HELPER UTILITIES
// --------------------------------------------------------------------------
function getRandomBotIdentity() {
  const name = botNamesList[Math.floor(Math.random() * botNamesList.length)]
  const possibleRanks = ['E', 'D', 'C']
  const rank = possibleRanks[Math.floor(Math.random() * possibleRanks.length)]
  return { name, rank }
}

function getRandomBotWord() {
  return botWordPool[Math.floor(Math.random() * botWordPool.length)]
}

function generateHumanTypo(word) {
  if (!word || word.length < 3) return word + 'e'
  const typoType = Math.floor(Math.random() * 3)

  if (typoType === 0) {
    // Swap two adjacent letters
    const idx = Math.floor(Math.random() * (word.length - 1))
    return word.slice(0, idx) + word[idx + 1] + word[idx] + word.slice(idx + 2)
  } else if (typoType === 1) {
    // Drop a letter
    const idx = Math.floor(Math.random() * word.length)
    return word.slice(0, idx) + word.slice(idx + 1)
  } else {
    // Phonetic/common letter swap
    if (word.includes('c')) return word.replace('c', 'k')
    if (word.includes('ph')) return word.replace('ph', 'f')
    if (word.includes('ee')) return word.replace('ee', 'ea')
    if (word.includes('m')) return word.replace('m', 'n')
    return word.slice(0, -1)
  }
}

// --------------------------------------------------------------------------
// 3. MATCHMAKING & QUEUE MANAGEMENT
// --------------------------------------------------------------------------
function enqueuePlayer(player) {
  // Clear any existing queue instances or timers for this socket
  clearPlayerFromQueue(player.socketId)

  // Start the individual 15-second matchmaking timer
  player.timer = setTimeout(() => {
    handleBotMatchmaking(player.socketId)
  }, MATCH_TIMEOUT_MS)

  matchmakingQueue.push(player)
  processMatchmakingQueue()
}

function clearPlayerFromQueue(socketId) {
  const index = matchmakingQueue.findIndex((p) => p.socketId === socketId)
  if (index !== -1) {
    const removed = matchmakingQueue.splice(index, 1)[0]
    if (removed.timer) clearTimeout(removed.timer)
  }
}

async function processMatchmakingQueue() {
  if (isMatching || matchmakingQueue.length < 2) return
  isMatching = true

  try {
    while (matchmakingQueue.length >= 2) {
      const p1 = matchmakingQueue[0]
      const p2Index = matchmakingQueue.findIndex((p, idx) => idx > 0 && p.userId !== p1.userId)

      if (p2Index === -1) break

      const p2 = matchmakingQueue.splice(p2Index, 1)[0]
      matchmakingQueue.shift() // Remove p1

      if (p1.timer) clearTimeout(p1.timer)
      if (p2.timer) clearTimeout(p2.timer)

      const s1 = io.sockets.sockets.get(p1.socketId)
      const s2 = io.sockets.sockets.get(p2.socketId)

      if (!s1 && s2) {
        enqueuePlayer(p2)
        continue
      }
      if (s1 && !s2) {
        enqueuePlayer(p1)
        continue
      }
      if (!s1 && !s2) {
        continue
      }

      await createRoom(p1, p2, false)
    }
  } catch (err) {
    console.error('[Matchmaking Queue Error]:', err)
  } finally {
    isMatching = false
  }
}

async function handleBotMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex((p) => p.socketId === socketId)
  if (index === -1) return

  const player = matchmakingQueue.splice(index, 1)[0]
  if (player.timer) clearTimeout(player.timer)

  const socket = io.sockets.sockets.get(player.socketId)
  if (!socket) return

  const { name, rank } = getRandomBotIdentity()
  const botPlayer = {
    socketId: null,
    userId: 'BOT_OPPONENT',
    username: name,
    photoURL: '',
    rank: rank
  }

  await createRoom(player, botPlayer, true)
}

// --------------------------------------------------------------------------
// 4. ROOM REGISTRATION & LIFECYCLE
// --------------------------------------------------------------------------
async function createRoom(p1, p2, isBot = false) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const s1 = io.sockets.sockets.get(p1.socketId)
  const s2 = isBot ? null : io.sockets.sockets.get(p2.socketId)

  // Deduct/Lock wagers atomically via Supabase
  const { error: rpcError } = await supabase.rpc('start_gem_battle', {
    p1_id: String(p1.userId),
    p2_id: String(p2.userId),
    gem_wager: WAGER_GEMS
  })

  if (rpcError) {
    console.error('[RPC Error] start_gem_battle failed:', rpcError.message)
    if (s1) s1.emit('match_error', 'Failed to lock gems wager.')
    if (s2) s2.emit('match_error', 'Failed to lock gems wager.')
    return
  }

  const roomState = {
    roomId,
    round: 1,
    isBot,
    p1: { id: p1.userId, name: p1.username, photoURL: p1.photoURL || '', socketId: p1.socketId, rank: p1.rank || 'E' },
    p2: { id: p2.userId, name: p2.username, photoURL: p2.photoURL || '', socketId: p2.socketId, rank: p2.rank || 'E' },
    attackerId: p1.userId,
    defenderId: p2.userId,
    currentWord: '',
    r1Word: '',
    r1Guess: '',
    r2Word: '',
    r2Guess: '',
    p1DefendedSuccess: false,
    p2DefendedSuccess: false,
    isSettled: false,
    botActionTimer: null
  }

  activeRooms.set(roomId, roomState)

  if (s1) {
    s1.join(roomId)
    s1.data.roomId = roomId
  }
  if (s2) {
    s2.join(roomId)
    s2.data.roomId = roomId
  }

  const matchPayload = {
    roomId,
    round: 1,
    p1: { id: p1.userId, name: p1.username, photoURL: p1.photoURL || '', rank: p1.rank || 'E' },
    p2: { id: p2.userId, name: p2.username, photoURL: p2.photoURL || '', rank: p2.rank || 'E' },
    attackerId: p1.userId,
    defenderId: p2.userId
  }

  if (s1) s1.emit('match_found', matchPayload)
  if (s2) s2.emit('match_found', matchPayload)
}

async function finalizeSymmetricMatch(room) {
  if (!room || room.isSettled) return
  room.isSettled = true

  if (room.botActionTimer) {
    clearTimeout(room.botActionTimer)
  }

  const p1Correct = room.p1DefendedSuccess
  const p2Correct = room.p2DefendedSuccess

  let p1GemDelta = 0
  let p2GemDelta = 0
  let p1ExpDelta = 0
  let p2ExpDelta = 0

  if (p1Correct && p2Correct) {
    p1GemDelta = WAGER_GEMS
    p2GemDelta = WAGER_GEMS
    p1ExpDelta = 5
    p2ExpDelta = 5
  } else if (!p1Correct && p2Correct) {
    p1GemDelta = 0
    p2GemDelta = WAGER_GEMS * 2
    p1ExpDelta = -5
    p2ExpDelta = 5
  } else if (p1Correct && !p2Correct) {
    p1GemDelta = WAGER_GEMS * 2
    p2GemDelta = 0
    p1ExpDelta = 5
    p2ExpDelta = -5
  } else {
    p1GemDelta = WAGER_GEMS
    p2GemDelta = WAGER_GEMS
    p1ExpDelta = -5
    p2ExpDelta = -5
  }

  try {
    const { error: rpcError } = await supabase.rpc('resolve_symmetric_battle', {
      p1_id: String(room.p1.id),
      p2_id: String(room.p2.id),
      p1_gem_delta: Number(p1GemDelta),
      p2_gem_delta: Number(p2GemDelta),
      p1_exp_delta: Number(p1ExpDelta),
      p2_exp_delta: Number(p2ExpDelta)
    })

    if (rpcError) {
      console.error(`[RPC Error] Room ${room.roomId} resolve failed:`, rpcError.message)
    }

    io.to(room.roomId).emit('battle_finished', {
      roomId: room.roomId,
      p1Id: room.p1.id,
      p2Id: room.p2.id,
      p1GemDelta,
      p2GemDelta,
      p1ExpDelta,
      p2ExpDelta,
      r1Word: room.r1Word,
      r1Guess: room.r1Guess,
      r2Word: room.r2Word,
      r2Guess: room.r2Guess
    })
  } catch (err) {
    console.error(`[Battle Error] Failed to finalize room ${room.roomId}:`, err)
  } finally {
    const s1 = io.sockets.sockets.get(room.p1.socketId)
    const s2 = io.sockets.sockets.get(room.p2.socketId)
    if (s1) {
      s1.leave(room.roomId)
      s1.data.roomId = null
    }
    if (s2) {
      s2.leave(room.roomId)
      s2.data.roomId = null
    }
    activeRooms.delete(room.roomId)
  }
}

// --------------------------------------------------------------------------
// 5. BOT TURN SIMULATION ENGINE
// --------------------------------------------------------------------------
function triggerBotDefend(room, challengeWord) {
  // Give the bot enough time to listen, think, and type like a human player.
  const simulatedDelay = BOT_RESPONSE_MIN_MS + Math.random() * BOT_RESPONSE_VARIATION_MS

  room.botActionTimer = setTimeout(() => {
    if (!activeRooms.has(room.roomId) || room.isSettled) return

    // Bots should be reliable, but occasional mistakes keep the match believable.
    let accuracyRate = 0.93 // Rank E
    if (room.p2.rank === 'D') accuracyRate = 0.95
    if (room.p2.rank === 'C') accuracyRate = 0.97

    const isCorrect = Math.random() < accuracyRate
    const guess = isCorrect ? challengeWord : generateHumanTypo(challengeWord)

    room.r1Guess = guess
    room.p2DefendedSuccess = isCorrect

    // Switch roles for Round 2 (Bot becomes Attacker, Human becomes Defender)
    room.round = 2
    room.attackerId = room.p2.id
    room.defenderId = room.p1.id
    room.currentWord = ''

    io.to(room.roomId).emit('round_transition', {
      roomId: room.roomId,
      round: 2,
      attackerId: room.p2.id,
      defenderId: room.p1.id,
      lastWasCorrect: isCorrect
    })

    // Trigger Bot's attack turn
    triggerBotAttack(room)
  }, simulatedDelay)
}

function triggerBotAttack(room) {
  // Simulated human typing/thinking delay (3.5 to 6 seconds)
  const typingDelay = 3500 + Math.random() * 2500

  room.botActionTimer = setTimeout(() => {
    if (!activeRooms.has(room.roomId) || room.isSettled) return

    const selectedWord = getRandomBotWord()
    room.currentWord = selectedWord
    room.r2Word = selectedWord

    io.to(room.roomId).emit('challenge_active', {
      roomId: room.roomId,
      wordForTTS: selectedWord,
      attackerId: room.attackerId,
      defenderId: room.defenderId,
      round: 2
    })
  }, typingDelay)
}

// --------------------------------------------------------------------------
// 6. SOCKET EVENT LISTENERS
// --------------------------------------------------------------------------
io.on('connection', (socket) => {
  // 1. Join Matchmaking
  socket.on('join_matchmaking', async ({ userId, username, photoURL, rank }) => {
    if (!userId) {
      socket.emit('match_error', 'Invalid player identity.')
      return
    }

    const cleanUserId = String(userId).trim()
    socket.data = {
      userId: cleanUserId,
      username: username || 'Hunter',
      photoURL: photoURL || '',
      rank: rank || 'E',
      roomId: null
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('gems')
        .eq('id', cleanUserId)
        .single()

      if (error || !profile || profile.gems < WAGER_GEMS) {
        socket.emit('match_error', `You need at least ${WAGER_GEMS} Gems to Battle!`)
        return
      }

      enqueuePlayer({
        socketId: socket.id,
        userId: cleanUserId,
        username: socket.data.username,
        photoURL: socket.data.photoURL,
        rank: socket.data.rank
      })
    } catch (err) {
      console.error('[Matchmaking Error]:', err)
      socket.emit('match_error', 'Error during matchmaking.')
    }
  })

  // 2. Submit Challenge Word
  socket.on('submit_challenge', ({ roomId, word }) => {
    const targetRoomId = roomId || socket.data?.roomId
    const room = activeRooms.get(targetRoomId)

    if (!room || room.isSettled) {
      socket.emit('match_error', 'Battle room session not found.')
      return
    }

    const senderId = String(socket.data?.userId || '').trim()
    const attackerId = String(room.attackerId || '').trim()

    if (senderId !== attackerId) {
      socket.emit('match_error', 'Only the current Attacker can submit the secret word.')
      return
    }

    const sanitizedWord = String(word || '').trim().toLowerCase()
    if (!/^[a-zA-Z]{2,20}$/.test(sanitizedWord)) {
      socket.emit('match_error', 'Word must contain 2-20 English letters only.')
      return
    }

    room.currentWord = sanitizedWord
    if (room.round === 1) {
      room.r1Word = sanitizedWord
    } else {
      room.r2Word = sanitizedWord
    }

    io.to(room.roomId).emit('challenge_active', {
      roomId: room.roomId,
      wordForTTS: sanitizedWord,
      attackerId: room.attackerId,
      defenderId: room.defenderId,
      round: room.round
    })

    // If opponent is a bot and is defending in Round 1
    if (room.isBot && room.defenderId === 'BOT_OPPONENT') {
      triggerBotDefend(room, sanitizedWord)
    }
  })

  // 3. Submit Spelling Answer
  socket.on('submit_answer', async ({ roomId, guess }) => {
    const targetRoomId = roomId || socket.data?.roomId
    const room = activeRooms.get(targetRoomId)

    if (!room || room.isSettled) return

    const senderId = String(socket.data?.userId || '').trim()
    const defenderId = String(room.defenderId || '').trim()

    if (senderId !== defenderId) {
      socket.emit('match_error', 'Only the current Defender can submit the spelling.')
      return
    }

    const sanitizedGuess = String(guess || '').trim().toLowerCase()
    const isCorrect = sanitizedGuess === room.currentWord

    if (room.round === 1) {
      room.r1Guess = sanitizedGuess
      room.p2DefendedSuccess = isCorrect

      room.round = 2
      room.attackerId = room.p2.id
      room.defenderId = room.p1.id
      room.currentWord = ''

      io.to(room.roomId).emit('round_transition', {
        roomId: room.roomId,
        round: 2,
        attackerId: room.p2.id,
        defenderId: room.p1.id,
        lastWasCorrect: isCorrect
      })
    } else {
      room.r2Guess = sanitizedGuess
      room.p1DefendedSuccess = isCorrect
      await finalizeSymmetricMatch(room)
    }
  })

  // 4. Disconnect Handler
  socket.on('disconnect', async () => {
    clearPlayerFromQueue(socket.id)

    const roomId = socket.data?.roomId
    if (roomId && activeRooms.has(roomId)) {
      const room = activeRooms.get(roomId)
      if (room && !room.isSettled) {
        room.isSettled = true

        if (room.botActionTimer) {
          clearTimeout(room.botActionTimer)
        }

        try {
          await supabase.rpc('refund_gem_battle', {
            p1_id: room.p1.id,
            p2_id: room.p2.id,
            gem_wager: WAGER_GEMS
          })
        } catch (refundErr) {
          console.error('[Refund Error]:', refundErr)
        }

        io.to(roomId).emit('match_error', 'Opponent disconnected. Match cancelled and wagers refunded.')

        const s1 = io.sockets.sockets.get(room.p1.socketId)
        const s2 = io.sockets.sockets.get(room.p2.socketId)
        if (s1) {
          s1.leave(roomId)
          s1.data.roomId = null
        }
        if (s2) {
          s2.leave(roomId)
          s2.data.roomId = null
        }

        activeRooms.delete(roomId)
      }
    }
  })
})

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    queuedPlayers: matchmakingQueue.length,
    activeMatches: activeRooms.size
  })
})

const PORT = process.env.PORT || 8080
httpServer.listen(PORT, () => {
  console.log(`⚡ Battle Server listening on http://localhost:${PORT}`)
})