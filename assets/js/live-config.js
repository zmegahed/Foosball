/*
 * One-time live connection setup.
 *
 * 1. Create a Firebase project.
 * 2. Enable Email/Password Authentication and Realtime Database.
 * 3. Paste the Web API key and Realtime Database URL below.
 * 4. Create the admin account shown by adminEmail in Firebase Authentication.
 *
 * After this file is configured, admin.html only asks for the password.
 */
window.NATIONS_CUP_LIVE = {
  enabled: false,
  firebaseApiKey: 'PASTE_FIREBASE_WEB_API_KEY',
  databaseURL: 'https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com',
  adminEmail: 'admin@nationscup.app',
  dataPath: 'tournament'
};
