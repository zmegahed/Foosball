# Nations Cup Foosball Tournament

A polished static tournament hub designed for GitHub Pages. It includes:

- A public live bracket and player roster
- A separate results control room
- Automatic byes for an uneven number of players
- Automatic winner progression after score entry
- Browser preview before publishing
- Direct publishing to `tournament-data.json` through the GitHub Contents API
- Manual JSON download as a fallback
- Responsive desktop, tablet, and mobile layouts

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

Open `admin.html`, go to **Results**, enter both scores, and save. Ties are blocked because each match must produce a winner. Winners automatically move into the next round.

The 13-player draw is placed into a balanced 16-slot bracket. The three unpaired players automatically advance through their opening byes.

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

## Editing the original players

The starting roster is stored in `tournament-data.json`. It can also be edited from **Tournament setup → Players & seeding**. Changing the player list or draw resets existing scores so later-round results cannot point to the wrong players.

## Main files

- `index.html` — public tournament hub
- `admin.html` — score entry and publishing dashboard
- `tournament-data.json` — shared tournament data
- `assets/js/tournament.js` — bracket engine and shared utilities
- `assets/js/public.js` — public rendering and live refresh
- `assets/js/admin.js` — results, setup, preview, and GitHub publishing
- `assets/css/styles.css` — public visual system
- `assets/css/admin.css` — control room styles
