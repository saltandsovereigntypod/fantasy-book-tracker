# The War College Archive

A private, immersive fantasy book tracking prototype inspired by dark military fantasy, dragon academies, rebel fliers, scholars, healers, infantry campaigns, and corrupted magic.

## Included in this prototype

- Six fully distinct path themes
- Path-specific language, rank ladders, colors, and layouts
- First-run onboarding and companion assignment quiz
- Book and series tracking foundation
- Reading progress updates
- Focused reading session timer
- Quick Mark capture flow
- Theory ledger with status and confidence
- Interactive draggable conspiracy wall
- Local rank progression
- Companion identity and signet
- Mobile-responsive interface
- Local browser storage

## Run locally

Open `index.html` directly, or run a simple static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload every file in this folder to the repository root.
3. Open repository **Settings**.
4. Choose **Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose your main branch and the root folder.
7. Save.

## Current storage behavior

This version does not use Supabase. Data is saved only in the current browser using `localStorage`.

That means:

- Data does not sync across devices.
- Clearing browser storage removes saved data.
- Friends cannot yet share theories or walls.
- Accounts are simulated through the local onboarding profile.

## Recommended next additions

- Supabase authentication and cloud sync
- Invitation-only friend groups
- Shared spoiler-safe walls
- Series, characters, artifacts, factions, and locations
- Theory evidence and contradiction links
- Full companion evolution system
- AI theory analyst through a protected server function
- Cover lookup and ISBN import

## Copyright note

This prototype does not contain official series artwork, text, maps, logos, or copyrighted character imagery. Add any privately used assets only if you have the right to use them.
