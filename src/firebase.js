import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { onAuthStateChanged as fbOnAuthStateChanged } from 'firebase/auth'

// Vite env values override the bundled config when they are provided.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyADgpYNzgohTbQ6xV-mHjXW4aLRJdo2yQE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'project-one-e61a5.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'project-one-e61a5',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'project-one-e61a5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '915850069421',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:915850069421:web:a61db2e330d20d63cccd24',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-4BGZ3JK4Q7',
}

const firebaseEnabled = Boolean(firebaseConfig.apiKey)

let auth = null
let loginWithGoogle = async () => {
  // default stub
  // eslint-disable-next-line no-console
  console.warn('loginWithGoogle called but Firebase is not configured.')
  throw new Error('Firebase not configured')
}
let logoutUser = async () => {}
let onAuthStateChanged = (cb) => {
  setTimeout(() => cb(null), 0)
  return () => {}
}

if (firebaseEnabled) {
  if (!getApps().length) {
    initializeApp(firebaseConfig)
  }
  auth = getAuth()
  const provider = new GoogleAuthProvider()

  loginWithGoogle = () => signInWithPopup(auth, provider)
  logoutUser = () => signOut(auth)
  onAuthStateChanged = (cb) => fbOnAuthStateChanged(auth, cb)
} else {
  // eslint-disable-next-line no-console
  console.warn('Firebase disabled: continuing in guest-only mode.')
}

export { auth, loginWithGoogle, logoutUser, onAuthStateChanged }
