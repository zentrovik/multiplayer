import { useState } from 'react'
import { loginWithGoogle } from '../firebase'
import bgImage from '../assets/login-bg.png'
import fullImage from '../assets/full.png'
import './Login.css'

export default function Login({ onGuestLogin }) {
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      await loginWithGoogle()
    } catch (error) {
      console.error('Google Sign-In Error:', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-backdrop" aria-hidden="true">
        <img src={fullImage} alt="" className="login-backdrop-image" />
        <div className="login-backdrop-tint" />
      </div>

      <div className="login-layout">
        <section className="login-hero">
          <img src={bgImage} alt="Bang Bang Rabbit game world" className="login-hero-image" />
          <div className="login-hero-shade" />
          <div className="login-brand">
            <p className="login-eyebrow">SEASON 01 / ARENA NETWORK</p>
            <h1><span>WORD WAR</span>ARENA</h1>
            <p className="login-tagline">Think fast. Spell faster.</p>
          </div>
          <div className="login-hero-footer">
           
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel-inner">
            <div className="login-panel-heading">
              <p className="login-eyebrow">PLAYER ACCESS</p>
              <h2>Enter the arena</h2>
              <p>Choose your account to continue your battle.</p>
            </div>

            <div className="login-panel-rule"><span>SELECT ENTRY</span></div>

            <div className="login-actions">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="login-button login-button-google"
              >
                <span className="login-button-icon login-button-icon-google" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </span>
                <span className="login-button-copy">
                  <strong>{loading ? 'Connecting...' : 'Continue with Google'}</strong>
                  <small>Sync your player profile</small>
                </span>
                <span className="login-button-arrow" aria-hidden="true">+</span>
              </button>

              <button
                type="button"
                onClick={onGuestLogin}
                className="login-button login-button-guest"
              >
                <span className="login-button-icon login-button-icon-guest" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </span>
                <span className="login-button-copy">
                  <strong>Play as guest</strong>
                  <small>Jump straight into practice</small>
                </span>
                <span className="login-button-arrow" aria-hidden="true">+</span>
              </button>
            </div>

            <div className="login-panel-note">
              <span className="login-lock" aria-hidden="true">+</span>
              <span>Secure sign-in · No progress lost</span>
            </div>

            <div className="login-version">BUILD 1.1.3.20633.0</div>
          </div>
        </section>
      </div>
    </div>
  )
}