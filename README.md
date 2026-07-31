# The War College Archive V3

A private, static, Empyrean-inspired reading tracker designed for GitHub Pages. This build uses browser localStorage and does not require Supabase.

## V3 changes

- Much steeper rank requirements across every path
- Dark Wielder ranks require dramatically more Power than the other paths
- Repaired Threshing and The Leap event buttons and completion flow
- Rider and Flier rank progression is hard-gated until the required event is completed
- Full-screen bond reveal appears immediately from any page after the event
- Unacknowledged bond reveals return after a refresh until accepted
- Reveal includes creature name, type, color, tail or channel, signet, and relic
- Optional local image uploads for a bonded dragon or gryphon and the user's relic
- Image compression before local storage to reduce browser quota usage
- Completely separate Dragon, Gryphon, and Wyvern name pools
- Permanent used-name registry prevents any creature name from being reused across species, even after changing paths

## Existing major features

- Six path-specific themes, voices, layouts, ranks, and progression systems
- Sealed Rider and Gryphon assessments with delayed bond reveal
- Immediate Dark Wielder wyvern assignment with grey wyverns and green, red, or blue fire
- Expanded dragon colors, tail types, gryphon types, signets, and mind-based flier abilities
- Book, series, progress, session, theory, and suspicion tracking
- Multiple conspiracy walls with user-created names and card categories
- Many-to-many links between cards, including cross-wall links and written reasons
- Books, theories, and suspicions as linked wall sources
- Global connection index and per-card link records
- Local browser persistence

## GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, and `app.js` to the repository root.
3. Open **Settings > Pages**.
4. Choose **Deploy from a branch**, select `main`, and select `/ (root)`.
5. Save and open the published URL after deployment completes.

## Important

Data and uploaded images are stored only in the current browser. Clearing site data removes them. Multi-device sync and friend sharing require the future Supabase phase.

## Version 3 progression and bond updates

- Rank thresholds are substantially higher, with Dark Wielder advancement requiring especially large totals.
- Threshing and The Leap are gated by both standing and completion of every event stage.
- Completing either event triggers a global bond reveal modal immediately, regardless of the active page.
- Unacknowledged bond reveals reopen after refresh until accepted.
- Bonded profiles can optionally store compressed images of the dragon or gryphon and relic locally in the browser.
- Dragon, gryphon, and wyvern names share one permanent used-name registry, preventing cross-species duplicate names.
- Every path now has its own permanent service record. Switching paths preserves and restores that path's exact points, rank, questionnaire, signet or lesser magic, creature, relic, event status, and uploaded images.
- Entering a bonded path for the first time opens its assessment. Returning to a previously entered path never rerolls the result.

## Path memory

Version 3 preserves a separate permanent progression record for every path. Switching paths no longer resets previous progress. Returning to a path restores its exact rank, points, questionnaire assessment, bonding event status, dragon/gryphon/wyvern, signet, relic, pending reveal state, and locally uploaded creature/relic images. Creature names remain reserved globally across every saved path.
