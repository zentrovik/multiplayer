// src/utils/soundFX.js

/**
 * Helper to safely play audio files from the /public directory.
 * Resets playback to start immediately even on rapid triggers.
 *
 * @param {string} src - Path to the audio file in the public directory
 * @param {number} volume - Volume level from 0.0 to 1.0 (default: 0.8)
 */
function playAudio(src, volume = 0.8) {
  try {
    const audio = new Audio(src);
    audio.volume = Math.min(Math.max(volume, 0), 1); // Clamp between 0.0 and 1.0
    audio.currentTime = 0;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Handled silently to avoid crashing if user hasn't interacted with DOM yet
        console.warn(`[soundFX] Playback blocked or failed for "${src}":`, err.message);
      });
    }
  } catch (error) {
    console.error(`[soundFX] Initialization error for "${src}":`, error);
  }
}

/**
 * 1. Button & Profile Click Sound (click.wav)
 */
export function playClickSound() {
  playAudio('/click.wav', 0.6);
}

/**
 * 2. Match Found / Clash Screen Start (ready.mp3)
 */
export function playMatchStartSound() {
  playAudio('/ready.mp3', 0.85);
}

/**
 * 3. Match Victory / Winner Screen (winsound.wav)
 */
export function playWinSound() {
  playAudio('/winsound.wav', 0.9);
}

/**
 * 4. Match Defeat / Draw / Loss Screen (lossesound.wav)
 */
export function playLossSound() {
  playAudio('/lossesound.wav', 0.85);
}