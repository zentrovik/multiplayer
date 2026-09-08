import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080'

/**
 * Creates and returns an isolated socket instance for a single battle session.
 * Using forceNew ensures distinct tabs do not share or cross-pollinate connection handles.
 */
export function createGameSocket() {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    forceNew: true, // Forces a new connection per browser tab/component
    reconnection: false,
    timeout: 10000,
  })

  // Development event logging
  if (import.meta.env.DEV) {
    socket.on('connect', () => {
      console.log(`[Socket Connected] Session ID: ${socket.id}`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] Reason: ${reason}`)
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket Connection Error]:', error.message)
    })
  }

  return socket
}

export default createGameSocket