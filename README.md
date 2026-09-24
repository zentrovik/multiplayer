Rankex

Rankex is a browser-based word battle and spelling game. Players listen to clear word pronunciation, type the correct spelling under pressure, earn Gems and EXP, and climb a competitive rank ladder from E to God Mode.

Live game: [rankex.space](https://rankex.space/)

Brand site: [zentrovik.netlify.app](https://zentrovik.netlify.app/)

## Project Overview

The project is a React and Vite frontend backed by a Node.js, Express, and Socket.IO battle server. Supabase stores player profiles, Gems, EXP, and battle settlement data. Firebase authentication supports account access, while guest access is available for non-ranked play.

The game is designed for desktop and mobile browsers. Its responsive screens cover the dashboard, practice flow, matchmaking, live battle turns, timer notifications, results, rank progress, and reward claims.

## Key Features

- **Dashboard:** Displays the player name, avatar, current rank, EXP, Gem balance, profile progress, and game actions.
- **Test Match:** A four-word spelling practice session using browser speech synthesis and normal or slow pronunciation playback.
- **Ranked Match:** A two-round online spelling duel against another player, with bot matchmaking when an opponent is not found.
- **Bot opponent:** Uses a filtered dictionary word pool, rank-based accuracy, human-like response timing, and simple bot identities.
- **Live timers:** Word selection and answer turns each use a 30-second server-controlled deadline.
- **Background recovery:** Socket reconnect, page visibility, browser wake, and network recovery handlers restore matchmaking or an active room without requiring a reload.
- **Spelling assistance:** Dictionary-backed validation and suggestions help players identify likely spelling mistakes.
- **Voice experience:** Sanitized words are sent to the browser voice engine for clearer pronunciation, including a slower playback option.
- **Battle results:** Shows each round's challenge and answer, Gem settlement, EXP change, winner or draw state, and battle status.
- **Rank progression:** Ranks are calculated from EXP: E at 0, D at 250, C at 500, B at 750, A at 1,000, S at 1,500, and God Mode at 2,000 EXP.
- **Accessibility-friendly feedback:** Important timer, timeout, matchmaking, error, and reward states are surfaced in visible UI messages.
- **Responsive visual design:** The game uses separate mobile and desktop layout constraints with animated battle feedback and reduced-motion support.

## Rewards and Economy

### Test Match

Test Match contains four words and does not require a wager:

| Correct answers | Reward |
| --- | --- |
| 0-1 | 0 Gems, 0 EXP |
| 2-3 | 1 Gem, 1 EXP |
| 4 | 3 Gems, 2 EXP |

Rewards are saved when the player completes the session and selects **Claim & Return**.

### Ranked Match

Ranked Match locks a 10-Gem wager when a room starts:

| Result | Settlement | EXP |
| --- | --- | --- |
| Win | 20 Gems returned, 10 Gems net profit | +5 |
| Draw | 10 Gems returned, no net change | +5 |
| Loss | Wager is lost | -5 |

Missing a live turn has a separate timeout penalty. A player loses 5 Gems when their 30-second word-selection timer expires and 10 Gems when their 30-second answer timer expires. If the bot times out, the real player is not charged.

## Advertising and Rewarded Ads

Rankex currently uses an opt-in, first-party rewarded-video flow rather than an external ad-network SDK. The complete flow is implemented in `src/components/Dashboard.jsx` and styled in `src/components/Dashboard.css`.

1. The player opens the Gem recharge control from the dashboard.
2. The app displays a reward prompt explaining that the complete video must be watched.
3. The video is loaded from `public/rewarded-ad.mp4` in a fullscreen playback stage.
4. The player sees loading, playback, countdown, progress, completion, close, retry, and unavailable-video states.
5. The reward remains locked while the video is incomplete.
6. The browser `ended` event marks the ad as complete and enables the claim button.
7. The player claims **+4 Gems**.
8. The updated Gem balance is written to Supabase for signed-in users. Guest users can view the flow but do not persist account rewards.

The implementation prevents early claims, resets playback state when closed, supports visibility recovery for the video, handles loading and media errors, and gives the player a visible progress indicator. There is currently no Google AdSense, third-party ad auction, tracking pixel, or external ad-network integration in this repository.

## Technology

- React 18 and React DOM
- Vite
- Node.js, Express, and Socket.IO
- Supabase JavaScript client
- Firebase authentication
- `nspell` and dictionary resources for spelling validation
- Browser Speech Synthesis and optional ResponsiveVoice script
- Tailwind CSS and component-level CSS

## Local Development

Install the frontend dependencies:

```
```bash
cd server
npm install
npm start
```

The frontend uses `VITE_SOCKET_URL` for the Socket.IO server URL. Supabase and authentication configuration are loaded through the environment variables used by `src/supabase.js` and `src/firebase.js`. Never commit service-role keys or private credentials.

Create a production build with:

```bash
npm run build
```

## Deployment and SEO

The production game URL is `https://rankex.space/`. The root `index.html` includes the canonical URL, search description, keyword set, author and publisher data, robots directives, Open Graph metadata, Twitter card metadata, VideoGame JSON-LD, theme metadata, web-app metadata, and the Zentrovik organization link at `https://zentrovik.netlify.app/`.

The public SEO files are:

- `public/robots.txt`
- `public/sitemap.xml`
- `public/site.webmanifest`
- `public/ZENTROVIK.png`

The supplied Zentrovik image is used as the browser tab icon, Apple touch icon, manifest icon, and social preview image.

## Repository Layout

```text
src/
	components/       Dashboard, practice match, and ranked battle UI
	data/             Word, name, and dictionary resources
	utils/            Socket, voice, spelling, sound, and word helpers
	assets/           Visual assets, including the Zentrovik logo
server/
	server.js         Express, Socket.IO, matchmaking, bot, timer, and settlement logic
public/
	rewarded-ad.mp4   Local rewarded-video asset
	robots.txt        Crawler rules
	sitemap.xml       Public site map
	site.webmanifest  Install and icon metadata
```

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
