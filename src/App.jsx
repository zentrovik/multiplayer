import { useState, useEffect } from 'react'
import { onAuthStateChanged, logoutUser } from './firebase'
import { getOrCreateProfile } from './supabase'
import { playClickSound } from './utils/soundFX'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [gameProfile, setGameProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enteringGame, setEnteringGame] = useState(false)

  // Global sound effect for buttons, profile icons, and interactive elements
  useEffect(() => {
    const handleGlobalClick = (event) => {
      const isInteractive = event.target.closest(
        'button, [role="button"], .cyber-avatar-inner, .profile-btn, .clickable'
      )
      if (isInteractive) {
        playClickSound()
      }
    }

    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  // Listen to Firebase authentication state
  useEffect(() => {
    let authRequestId = 0
    let isMounted = true

    const unsubscribe = onAuthStateChanged(async (currentUser) => {
      const requestId = ++authRequestId

      if (currentUser) {
        const baseUser = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Shadow Warrior',
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          isGuest: false,
        }
        setUser(baseUser)

        // Render a usable profile immediately while the database profile loads.
        const fallbackProfile = {
          id: baseUser.uid,
          username: baseUser.displayName,
          email: baseUser.email || '',
          photo_url: baseUser.photoURL || '',
          rank: 'E',
          exp: 0,
          gems: 100,
        }
        setGameProfile(fallbackProfile)

        // Sync with Supabase PostgreSQL
        try {
          const profile = await getOrCreateProfile(baseUser)
          if (isMounted && requestId === authRequestId) {
            setGameProfile(profile ? { ...fallbackProfile, ...profile } : fallbackProfile)
          }
        } catch (error) {
          console.error('Profile sync error:', error)
        }
      } else {
        if (isMounted && requestId === authRequestId) {
          setUser((prev) => (prev?.isGuest ? prev : null))
          setGameProfile((prev) => (prev?.isGuest ? prev : null))
        }
      }

      if (isMounted && requestId === authRequestId) {
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Handle Guest Login
  const handleGuestLogin = () => {
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substring(2, 9),
      displayName: 'Guest Warrior',
      email: 'guest@bangbangrabbit.local',
      photoURL: null,
      isGuest: true,
    }
    setEnteringGame(true)
    window.setTimeout(() => {
      setUser(guestUser)
      setGameProfile({
        id: guestUser.uid,
        username: guestUser.displayName,
        rank: 'E',
        coins: 1000,
        isGuest: true,
      })
      setEnteringGame(false)
    }, 900)
  }

  // Handle Logout
  const handleLogout = async () => {
    if (user?.isGuest) {
      setUser(null)
      setGameProfile(null)
    } else {
      try {
        await logoutUser()
        setUser(null)
        setGameProfile(null)
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
  }

  // Loading state
  if (loading || enteringGame) {
    return (
      <div className="game-world-loader" role="status" aria-live="polite">
        <div className="game-world-loader-grid" aria-hidden="true" />
        <div className="game-world-loader-core">
          <div className="game-world-loader-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="game-world-loader-kicker">WORD WAR ARENA</p>
          <p className="game-world-loader-text">{enteringGame ? 'Opening arena...' : 'Initializing game world...'}</p>
          <div className="game-world-loader-progress" aria-hidden="true">
            <span />
          </div>
          <p className="game-world-loader-code">SYNC // READY</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black">
      {user ? (
        <Dashboard
          user={user}
          gameProfile={gameProfile}
          setGameProfile={setGameProfile}
          onLogout={handleLogout}
        />
      ) : (
        <Login onGuestLogin={handleGuestLogin} />
      )}
    </main>
  )
}