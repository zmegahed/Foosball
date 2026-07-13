# Nations Cup Foosball Tournament

A polished static tournament hub designed for GitHub Pages. It includes:

- A public live bracket, schedule, and player roster
- A separate results and scheduling control room
- A 14-player single-elimination draw
- Two opening-round byes, with no automatic byes after Round 1
- Automatic winner progression after score entry
- Editable date, time, and table slots for every played match
- Automatic timetable generation based on match length and number of tables
- Browser preview before publishing
- Direct publishing to `tournament-data.json` through the GitHub Contents API
- Manual JSON download as a fallback
- Responsive desktop, tablet, and mobile layouts

## Important bracket note

A standard single-elimination bracket must reduce to 8, 4, 2, and then 1 player. Therefore:

- 14 players require **two opening-round byes** in a 16-slot bracket.
- Exactly one opening-round bye would require **15 players**.

This project keeps both required byes strictly in the Round of 16. An unfinished feeder match can never be mistaken for a later-round bye, so nobody advances through the quarterfinals, semifinals, or final without a result.

The supplied contestant list contained 13 names, so the project includes an editable **Player 14 / Nation TBD** entry. Replace that entry from **Tournament setup → Players & seeding**.

## Fastest GitHub Pages setup

1. Create a new GitHub repository, such as `nations-cup`.
2. Upload everything in this folder to the repository root.
3. Open **Settings → Pages** in GitHub.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Your public site will be available at:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`
7. The results control room will be at:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html`

## Entering results

Open `admin.html`, go to **Results**, enter both scores, and save. Ties are blocked because each match must produce a winner. Winners automatically move into the next round only after both feeder matches are complete.

## Setting the date slots

Open **Schedule** in the control room.

Use **Generate the timetable** to enter:

- Tournament start date
- First match time
- Expected minutes per match
- Number of foosball tables available
- Break between rounds

Press **Generate date slots**. The control room creates a slot for all 13 played matches and skips the two opening byes. You can then edit any match date, time, or table individually before saving and publishing.

The public page displays scheduled times inside the bracket and in a dedicated chronological **Match schedule** section.

## Previewing changes

The control room stores edits in browser local storage. Press **Open preview** to see those unpublished changes on the public layout.

Browser preview data is device-specific. Other visitors will not see it until you publish.

## Publishing directly from the control room

Create a fine-grained GitHub personal access token that:

- Can access only this tournament repository
- Has repository **Contents** permission set to **Read and write**

In the control room, enter:

- Repository owner: your GitHub username or organization
- Repository name
- Branch: usually `main`
- File path: `tournament-data.json`
- Your fine-grained token

Press **Publish live results**. The page updates `tournament-data.json` through GitHub's repository contents API.

### Token safety

- Never paste a token into any project file.
- Never commit a token to GitHub.
- Leave **Remember the token** unchecked on shared devices.
- The admin page is a convenience dashboard, not a secure authentication system. Keep its URL private where practical.

## Manual publishing fallback

Press **Download data file instead** in the Publishing tab. Replace the repository's existing `tournament-data.json` with the downloaded file and commit the change.

## Main files

- `index.html` — public tournament hub
- `admin.html` — score entry, scheduling, and publishing dashboard
- `tournament-data.json` — shared tournament data
- `assets/js/tournament.js` — bracket engine and shared utilities
- `assets/js/public.js` — public bracket, schedule, roster, and live refresh
- `assets/js/admin.js` — results, scheduling, setup, preview, and GitHub publishing
- `assets/css/styles.css` — public visual system
- `assets/css/admin.css` — control room styles
