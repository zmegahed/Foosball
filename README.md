# Nations Cup — GitHub Pages Website

A responsive 13-player foosball tournament hub with a public bracket, match schedule, player roster, and password-gated tournament desk.

## Tournament format

- 13 total players
- Five played matches in the opening round
- Three opening-round byes
- Eight players in the quarterfinals
- No byes after the opening round
- Winners advance automatically after a score is saved

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)` folder.
6. Open the GitHub Pages address shown by GitHub.

The public tournament page is the repository’s main URL.

The private management page is available only by typing:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html
```

There is no admin link or management wording on the public homepage.

## Admin password

The initial password is:

```text
NationsCup13!
```

Open `admin.html`, enter that password, and manage the tournament. The desk remains unlocked for the current browser session until **Lock desk** is pressed or the session ends.

A replacement password can be set under **Tournament setup → Admin access**. Because GitHub Pages is static, a password changed through the page applies only to that browser. The built-in password gate is a convenience barrier, not server-side authentication.

## Enter results

Open **Results**, enter both scores, and press **Save result**. Ties are blocked. The winner is placed into the correct next-round match automatically.

## Create date slots

Open **Schedule** and set:

- Tournament start date
- First match time
- Expected match duration
- Number of foosball tables
- Break between rounds

Press **Generate date slots**. The site creates all 12 playable match slots and skips the three opening-round byes. Every date, time, and table can be edited individually.

## How saving works

Changes save automatically in the current browser and appear on the public page when it is opened in that same browser.

GitHub Pages cannot securely update shared website files using only a browser password. To make the latest results visible to visitors on every device without entering repository credentials in the site:

1. Open **Tournament setup → Data tools**.
2. Press **Download backup**.
3. Replace `tournament-data.json` in the GitHub repository with the downloaded file.

The **Restore backup** button can load that file on another device.

## Files

- `index.html` — public tournament hub
- `admin.html` — password-gated tournament desk
- `tournament-data.json` — shared starting data
- `assets/js/tournament.js` — bracket and storage engine
- `assets/js/public.js` — public page rendering
- `assets/js/admin.js` — password gate, score entry, scheduling, and setup
- `assets/css/styles.css` — public styles
- `assets/css/admin.css` — admin and login styles
