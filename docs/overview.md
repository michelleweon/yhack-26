# 🦝 Heist! — Game Overview

A Jackbox-style party trivia game for 4–8 players. One screen, everyone's phones, one heist.

---

## Concept

Heist! is a local party game where players work (and compete) as a crew of raccoon thieves attempting to pull off the ultimate heist. Answer trivia questions to advance through heist locations, survive minigames when you get caught, and be the first to crack the vault.

Inspired by Jackbox's Trivia Murder Party — one host display on a TV or shared screen, players join and interact entirely from their phones via a room code. No app download required.

---

## Art Direction

- **Style:** Goofy flat comic book illustration — thick hand-inked outlines, cel-shading, Ben-Day dot textures, aged paper grain
- **Characters:** A crew of 5 raccoon archetypes, each differentiated by role and accent color
- **Backgrounds:** Dark noir graphic novel environments — rooftops, museums, vaults, jail cells
- **UI Chrome:** Riveted steel / vault aesthetic — combination lock timer, metal panel framing
- **Typography:** Bangers (titles), Barlow Condensed ExtraBold (UI), Caveat (handwritten notes), Special Elite (newspaper clippings)

---

## Characters (Raccoon Crew)

8 raccoon characters — randomly assigned on join. No player choice. Supports 1–8 players.

| # | Role | Accent Color | Trait |
|---|------|-------------|-------|
| 1 | Thief / Burglar | Black & cream | Dopey, lovable |
| 2 | Mastermind / Planner | Navy & gold | Smug, over-prepared |
| 3 | Lookout / Hacker | Green & grey | Nervous, paranoid |
| 4 | Getaway Driver | Red & yellow | Focused, reckless |
| 5 | Safe Cracker | Tan & deep red | Intense, methodical |
| 6 | TBD | TBD | TBD |
| 7 | TBD | TBD | TBD |
| 8 | TBD | TBD | TBD |

---

## Game Locations (Scenes)

🚧 Art direction TBD — locations and background art to be defined once illustration style is finalized.

| Scene | Purpose |
|-------|---------|
| TBD | Trivia question location |
| TBD | Trivia question location |
| TBD | Trivia question location |
| TBD | Minigame location |
| TBD | Final level / vault |

---

## Game Flow

All screens (host + phone) show a ⚙️ settings gear in the top left corner at all times.

### 🏠 Home Screen (Host — 16:9 landscape)
- Create Room or Join Room buttons
- Host and phone players can both upload PDFs from this screen
- PDF processing triggers immediately on upload (see PDF Pipeline below)

### 🏠 Room Home (Host — 16:9 landscape)
- Displays room code prominently for players to join
- Player list with randomly assigned raccoon character icons
- Host can manage uploaded PDFs — select/deselect which to include, upload more, remove
- Phone players can also upload PDFs from the waiting screen — appear in host's list in real time
- Minimum 1 player to start
- Start game button unlocked once at least 1 player has joined and at least 1 PDF has been processed

### 📱 Phone — Join Flow
- Player enters room code in browser
- Randomly assigned a raccoon character (no selection)
- Sees PDF upload option + waiting screen until game starts

### 🎬 Intro / Tutorial Loading Screen (Host)
- Brief animated intro establishing the heist premise
- Tutorial explaining: question format, timer, minigame elimination rules

### ❓ Question Phase (Host — 16:9 landscape)
- Background scene sets the heist location (TBD art)
- Question text displayed prominently
- 4 answer choices always shown — always exactly 1 correct answer
- Combination lock timer overlay counting down
- Phase ends when all active players have answered OR timer runs out
- 7–8 questions per game — 8 by default, drops to 7 if the active pool has fewer than 8 unique unused questions. Vault Run triggers after the final question round.

### 📱 Phone — Question Phase
- Displays 4 large answer choice buttons (A / B / C / D)
- Locks in on tap, shows "Waiting for others..." until phase ends
- Eliminated players see spectator view

### 📊 Results Phase (Host)
- Correct answer revealed
- Flat points awarded to correct players — no deductions for wrong answers
- Raccoon character reactions shown per player (correct / wrong)

### 🎮 Minigame Phase — Rapid Math
- Triggered for any player who answered incorrectly — even one wrong answer
- Correct players watch from the host screen (scoreboard / spectator view)
- Phone becomes the minigame interface — rapid fire math problems (all 4 operations: +, −, ×, ÷)
- 30 second timer
- **Survival rule:**
  - If 2+ players are in the minigame → only the player with the most correct answers survives. All others are eliminated. Ties = both survive.
  - If 1 player is in the minigame → they must get 15 correct answers to survive. Fail = eliminated.
- Eliminated players become permanent spectators for the rest of the game
- Host screen shows live progress of each struggling player during minigame
- If all remaining players are eliminated → game ends immediately (no vault run)
- Future minigames: lockpick, safe crack, distract guard

### 🔄 Disconnect / Rejoin
- If a player disconnects mid-game, the game continues without them
- Player can rejoin via room code and resume from current game state
- Room persists between full game sessions (play again without re-joining)

### 🏁 Final Level — Vault Run
- Host shows a horizontal progress slider — raccoons positioned by current score, vault on the right
- Wager-style trivia: players bet a percentage of their current score before each question
- Higher risk = higher reward — standings can flip dramatically
- First raccoon to reach the vault wins
- Only non-eliminated players participate

### 🏆 Win Screen
- Winning player revealed with fanfare
- Full scoreboard summary
- Play Again option — room persists, returns to Room Home
- Early game over — if all active players are eliminated during a minigame before vault run, game ends immediately with a "Nobody made it" screen showing final standings

---

## Timer

A combination safe dial widget overlays all screens. The outer ring drains clockwise in red as time runs out. A large bold countdown number sits in the center. Sound: slow ticking that increases in speed and pitch, culminating in an alarm buzz at zero.

---

## Player Count

1–8 players | Local / LAN party play | No app install required | Host is a separate non-playing display

---

## PDF → Question Pipeline

1. **Upload** — host or any phone player uploads a PDF (max recommended: 10MB / ~100 pages)
2. **Extract** — server extracts text from PDF on upload
3. **Keyword labeling** — LLM tags the content with topic keywords
4. **Cache check** — query Supabase for existing questions matching those keywords
5. **Generate if needed** — on cache miss, call LLM API to generate multiple choice questions
6. **Question format** — always 4 choices, exactly 1 correct answer, returned as strict JSON:

```json
{
  "question": "string",
  "choices": ["A", "B", "C", "D"],
  "correct": 0,
  "keywords": ["tag1", "tag2"]
}
```

7. **Store** — save generated questions + keyword labels to Supabase
8. **Ready** — questions enter the room's active pool

Token cost is minimized by always checking Supabase first. Identical or similar PDFs will hit the cache and skip generation entirely.

### PDF Display on Host (Room Screen)
- Uploaded PDFs shown as a toggleable list on the host screen
- Each PDF has an on/off toggle — toggled-off PDFs are excluded from the question pool
- Phone-uploaded PDFs require host approval before processing begins
  - Pending PDFs appear in the list with an Approve / Reject action
  - Processing (text extraction → cache check → LLM generation) only starts on host approval
  - Approved PDFs then appear as toggleable entries like any host-uploaded PDF
- Phone-uploaded PDFs show the uploader's raccoon icon next to the filename
- Host can remove any PDF from the list entirely

---

## Scoring

- **Starting balance** — every player begins with $100
- **Per correct answer** — earn $100 flat, no speed bonus, no deductions
- **Minigame** — triggered for any player who gets a question wrong. Fail the minigame = permanently eliminated
- **Wager system (Final Level)** — players bet a percentage of their current balance before each vault run question. Win = gain that amount. Lose = lose that amount.
- Minimum balance going into vault run is $100 (players who never lost a question) up to $100 × rounds answered correctly
- No $0 edge case possible given starting balance and no-deduction rules

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + TypeScript |
| Real-time sync | Supabase Realtime (broadcast + presence) |
| Host display | React + Framer Motion |
| Phone controllers | React |
| Build tooling | Vite |
| Database | Supabase (question cache + room persistence) |
| Question generation | LLM API (called server-side on upload) |
| PDF parsing | Server-side text extraction |

---

## Architecture

```
Players' Phones (React)
        ↕ Supabase Realtime (WebSocket)
   Node.js Server (TS)  ←→  Supabase (question cache + room state)
        ↕ Supabase Realtime (WebSocket)  ←→  LLM API (on cache miss)
   Host Display (React + Framer Motion)
```

Supabase Realtime is the single source of truth for all live game state, using its built-in broadcast and presence channels. The host display and phone controllers are pure clients — they render state and send inputs, never making game logic decisions themselves. The Node.js server handles all game logic and communicates state changes through Supabase Realtime. Supabase also handles persistence (questions, room state) outside of the live session.

---

## Folder Structure

```text
.
├── client/                  # Main game client
│   └── src/
│       ├── assets/          # Runtime assets bundled by Vite
│       ├── host/            # Host display flows
│       ├── phone/           # Phone controller flows
│       ├── shared/          # Shared UI and layout primitives
│       └── services/        # API and Supabase integrations
├── assets/
│   └── raw/                 # Reference media and source art
├── apps/
│   └── studyslayer/         # Separate standalone app kept in-repo
└── docs/                    # Product and deployment documentation
```

```
/server
  /rooms         ← room + session logic
  /game          ← game loop, phase logic
  /questions     ← JSON question files
  index.ts

/client
  /host          ← React + Framer Motion host display
    /views       ← one component per game phase
    /components  ← shared UI (timer, scoreboard, etc.)
    /assets      ← backgrounds, characters, UI
  /phone         ← React phone controller UI
    /views
    /components

vite.config.ts
```

---

## Host Views (React + Framer Motion)

| View | Trigger |
|------|---------|
| `HomeView` | App launch — create or join room, PDF upload |
| `RoomView` | Room created — player list, PDF selection, room code |
| `IntroView` | Game start — animated intro + tutorial |
| `QuestionView` | Each question round — question, choices, timer overlay |
| `ResultsView` | After each question — answer reveal, score update |
| `MinigameView` | After results — rapid math spectator / scoreboard view |
| `VaultRunView` | Final level — progress slider, wager trivia |
| `WinView` | Game over — winner reveal, final scoreboard |

All view transitions are handled by Framer Motion (`AnimatePresence` + `motion.div`).

---

## Deployment

Designed for local / LAN party play — the server runs on one machine on the local network. Players connect via a room code in their phone browser. No internet connection required during play (except for initial Supabase connection for room persistence and question cache).

Future option: self-hosted VPS ($5/month on Hetzner or DigitalOcean) for remote play sessions.

---

## Roadmap

### Foundation
- [ ] Project scaffold (Node.js + React + Vite + Supabase)
- [ ] Home screen — create/join room, PDF upload (host + phone)
- [ ] Room screen — room code, player list, PDF management
- [ ] Phone join flow — room code entry, random character assignment
- [ ] Room persistence — play again without rejoining
- [ ] Supabase Realtime channels — broadcast + presence setup

### PDF & Question Pipeline
- [ ] PDF upload + text extraction (host and phone)
- [ ] Keyword labeling from extracted text
- [ ] Supabase cache check by keyword
- [ ] LLM question generation on cache miss
- [ ] Store + serve questions from Supabase

### Core Loop
- [ ] Game state machine (home → room → intro → question → results → minigame? → repeat → vaultrun → win)
- [ ] Question phase — host display + phone answer buttons
- [ ] Combination lock timer overlay
- [ ] Results phase — answer reveal, flat scoring
- [ ] Phase ends on all answered or timeout
- [ ] Disconnect handling — continue without, allow rejoin

### Minigame — Rapid Math
- [ ] Triggered only for wrong-answer players
- [ ] Phone minigame UI — rapid fire all 4 operations
- [ ] 30 second timer
- [ ] Pass/fail threshold → elimination on fail
- [ ] Host spectator view showing minigame progress live

### Final Level — Vault Run
- [ ] Progress slider UI on host
- [ ] Wager UI on phone (percentage of score)
- [ ] Wager trivia loop
- [ ] Win condition — first to vault
- [ ] Win screen + play again flow

### Polish
- [ ] Settings gear overlay (all screens)
- [ ] Intro / tutorial animated screen (Framer Motion)
- [ ] Art integration — backgrounds + characters
- [ ] Sound design — ticking timer, correct/wrong SFX, elimination sting
- [ ] Additional minigames (lockpick, safe crack)
