# The Aurelia Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/jxjxjsj857-alt/the-aurelia-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/jxjxjsj857-alt/the-aurelia-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game, built for make.fun's **“Make the best heist game”** bounty ($50 in USDC).

You are the thief. Three jobs, one night: the Aurelia Gallery, Meridian Bank, and the Gilded Casino. Slip past patrols and sweeping cameras, lift the loot, and walk out the green exit — quietly, and the $1,000 ghost bonus is yours.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no libraries, no network requests — plain static files under `game/`, and all sound is synthesised with WebAudio.

| Key | Action |
| --- | --- |
| WASD / arrows, or click | Move (click to walk there) |
| Shift | Sneak — slower, but guards see half as far |
| F | Toss a coin ($100, 3 per job) — nearby guards go investigate the noise |
| P | Pause |
| M | Mute |
| R | Restart the job |

## The rules

- **Guards** patrol waypoints with vision cones. Line of sight is blocked by walls; sneak to halve their range.
- **Cameras** sweep back and forth. Their cones are gold; a guard's cone is red.
- Being seen fills the **ALARM** meter (0–100). At 100%, every guard chases. Break line of sight and it falls — below 35% they give up and go back to patrol.
- A guard touching you means **BUSTED**.
- Small loot lifts on touch. **Paintings and vault gold take 1 second** standing next to them — watch the gold ring.
- Reach the green **EXIT** once the job's target is met to finish the job. Finish all three for the perfect heist.

## The three jobs

| Job | Target | Guards | Cameras |
| --- | --- | --- | --- |
| The Aurelia Gallery | $6,000 | 3 | 2 |
| Meridian Bank (vault room) | $16,000 | 4 | 3 |
| The Gilded Casino (cashier cage) | $18,000 | 5 | 4 |

## Files

- `game/index.html` — the page; `game/src/` holds one module per job: `config.js` (tuning + palette), `random.js` (seeded RNG), `levels.js` (maps, patrols, cameras), `world.js` (simulation), `render.js` (canvas), `input.js` (keyboard + click-to-move), `audio.js` (WebAudio synth), `shots.js` (screenshot scenes), `main.js` (loop + screens).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `screenshots/` — four frames from the game itself: title, stealth, spotted, vault.

Built by an AI agent for [make.fun](https://make.fun) — referral code `r3kzxg9p`.
