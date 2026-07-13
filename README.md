# Nations Cup — Live GitHub Pages Website

A responsive 13-player foosball tournament hub with a public bracket, match schedule, player roster, and password-gated admin page.

## What changed

The site now uses Firebase Realtime Database for shared tournament data.

After the one-time Firebase connection is completed:

- Open `admin.html`
- Enter only the tournament password
- Save a score, schedule, player, draw, or event change
- The public page updates immediately for every visitor
- No repository owner, repository name, GitHub token, JSON download, or GitHub file replacement is required

The public homepage contains no admin link or admin instructions. Access the management page manually at `/admin.html`.

## Tournament format

- 13 total players
- Five played matches in the opening round
- Three opening-round byes
- Eight players in the quarterfinals
- No byes after the opening round
- Winners advance automatically after a non-tied score is saved

# One-time live setup

GitHub Pages hosts static HTML, CSS, and JavaScript, so a small database is required to save shared results. This package is already coded for Firebase; you only need to connect your own free Firebase project once.

## 1. Create a Firebase project

1. Open <https://console.firebase.google.com/>.
2. Select **Create a project**.
3. Google Analytics is not required for this tournament site.

## 2. Create the live database

1. Inside the Firebase project, open **Build → Realtime Database**.
2. Select **Create Database**.
3. Choose the database region closest to you.
4. Start in locked mode.
5. Open the **Rules** tab.
6. Replace the rules with the contents of `firebase-rules.json` from this package.
7. Select **Publish**.

These rules allow everyone to view tournament data but only the authenticated `admin@nationscup.app` account to change it.

## 3. Create the admin password

1. Open **Build → Authentication**.
2. Select **Get started**.
3. Under **Sign-in method**, enable **Email/Password**.
4. Open the **Users** tab and select **Add user**.
5. Use this email exactly:

```text
admin@nationscup.app
```

6. Choose the password you want to enter on `admin.html`.

The email is hidden inside the site configuration. The admin screen asks only for the password.

## 4. Copy the Firebase connection values

1. Open **Project settings → General**.
2. Under **Your apps**, add a Web app using the `</>` button if one does not exist.
3. Copy the value labeled `apiKey` from the Firebase configuration.
4. Return to **Realtime Database** and copy the database URL shown at the top of the Data tab. It normally resembles:

```text
https://your-project-id-default-rtdb.firebaseio.com
```

## 5. Complete `assets/js/live-config.js`

Open `assets/js/live-config.js` and change:

```js
window.NATIONS_CUP_LIVE = {
  enabled: true,
  firebaseApiKey: 'YOUR_REAL_FIREBASE_WEB_API_KEY',
  databaseURL: 'https://your-project-id-default-rtdb.firebaseio.com',
  adminEmail: 'admin@nationscup.app',
  dataPath: 'tournament'
};
```

Do not put the admin password in this file. The Firebase Web API key is an app configuration value; write access is protected by Firebase Authentication and the database rules.

## 6. Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)` folder.
6. Open the GitHub Pages address shown by GitHub.

Public page:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

Admin page:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html
```

## First admin login

The first successful admin login uploads the original 13-player tournament data to Firebase automatically. After that, the public page reads from Firebase and receives live updates.

## Enter results

1. Open `admin.html`.
2. Enter the Firebase admin password.
3. Open **Results**.
4. Enter both scores.
5. Select **Save result**.

Tied scores are blocked. The winner advances automatically, the shared database is updated, and connected public pages refresh immediately.

## Create date slots

Open **Schedule** and set:

- Tournament start date
- First match time
- Expected match duration
- Number of foosball tables
- Break between rounds

Select **Generate date slots**. The site creates all 12 playable match slots and excludes the three opening-round byes. Every date, time, and table can be edited individually.

## Change the password

Open **Tournament setup → Admin access**. The new password is changed through Firebase and works on every device.

## Backup and restore

The backup tools remain available for safety. Restoring a backup publishes the restored data to the live public page automatically.

## Files

- `index.html` — public tournament hub
- `admin.html` — password-gated tournament desk
- `tournament-data.json` — original fallback data
- `firebase-rules.json` — secure public-read/authenticated-write rules
- `assets/js/live-config.js` — one-time Firebase connection values
- `assets/js/live-data.js` — authentication, shared saving, and live updates
- `assets/js/tournament.js` — bracket and data engine
- `assets/js/public.js` — public page rendering and live listener
- `assets/js/admin.js` — password login, score entry, scheduling, and live publishing
- `assets/css/styles.css` — public styles
- `assets/css/admin.css` — admin and login styles


## Troubleshooting

### Password form reloads instead of opening the desk

Confirm that both `admin.html` and `index.html` load these scripts in this order:

```html
<script src="assets/js/tournament.js"></script>
<script src="assets/js/live-config.js"></script>
<script src="assets/js/live-data.js"></script>
```

The admin page then loads `assets/js/admin.js`, while the public page loads `assets/js/public.js`. The login form also includes a no-reload fallback.

## Admin login build

This package already contains the configured Firebase connection supplied for the project.
Upload the entire package together so `admin.html`, `assets/js/admin.js`, `assets/js/live-data.js`, and `assets/js/live-config.js` stay on the same build.

On `admin.html`, the login screen should display `Admin build 2026.07.12.3` and `Firebase connection found. Enter your tournament password.` before login.
If either message is missing, GitHub Pages is serving an older or incomplete deployment.
