# Variety Co. Firebase Setup

This guide turns the Firebase files already in this project into a real online backend.

## What you will have at the end

- A Firestore database for the Variety catalog, guest carts, and fake-payment orders
- Anonymous guest sign-in, so each visitor has their own saved cart
- Protected Cloud Functions that create the catalog and validate fake-payment orders
- Firestore Security Rules that protect customer data and store prices
- A Firebase Hosting setup for putting the website online later

The website continues to work locally if you pause at any point.

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Select **Create a project**.
3. Name it something like `variety-co`.
4. Finish the setup choices and wait for Firebase to create the project.
5. From the project overview, click the **Web** icon.
6. Give the web app a nickname such as `Variety website`.
7. Click **Register app**.

Firebase will show you a configuration object. Keep that page open for the next step.

## 2. Paste your web configuration

Open `firebase-config.js` in Visual Studio Code.

Replace only the text that begins with `PASTE_`. For example, Firebase gives you values for:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Then open `.firebaserc` and replace:

```
REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID
```

with the same value as `projectId`.

The Firebase web configuration identifies the project. It is not a private password. The real protection comes from the Security Rules in `firestore.rules`.

## 3. Turn on the Firebase services

In Firebase Console for your new project:

1. Open **Authentication**.
2. Select **Get started**.
3. Open **Sign-in method**.
4. Enable **Anonymous**.
5. Open **Firestore Database**.
6. Select **Create database**.
7. Choose **Production mode**.
8. Choose a database location near your expected visitors.

The project uses anonymous accounts at first. That creates a private guest cart without making visitors fill out a sign-up form. We can add a friendly email/password account page later.

## 4. Install the project tools

Open the Terminal inside Visual Studio Code in this project folder. Run these one at a time:

```bash
npm install
npm install --prefix functions
```

The first command installs the Firebase command-line tool for this project. The second command installs the server packages used by the Cloud Functions.

Cloud Functions in this project use Node.js 22. If Firebase tells you that your Node version is unsupported, install or switch to Node.js 22 before deploying.

## 5. Sign in and deploy

Still in the project folder, run:

```bash
npx firebase login
npx firebase deploy
```

A browser window will ask you to sign in to the Google account that owns your Firebase project.

The deploy command sends these pieces to Firebase:

- The website files for Firebase Hosting
- The two Cloud Functions
- The Firestore Security Rules
- The Firestore index for viewing a user's orders in newest-first order

After deployment, Firebase prints the website address. Open that address and build a pack.

## 6. Test the backend

After you choose a vibe or change products:

1. Open Firebase Console.
2. Open **Firestore Database**.
3. Look for the `products`, `packOptions`, and `vibePresets` collections.
4. Look in `users` for the visitor's private cart document.
5. On the Cart page, click **CHECK OUT WITH TEST CARD** when the selected pack is full.
6. Use only the displayed test values: `4242 4242 4242 4242`, `12/34`, and `123`.
7. Look in the `orders` collection for the new fake-payment order.

A fake-payment order is only a learning record. It does not charge money or start real shipping. The browser sends a fixed test token to the Cloud Function, never the card fields you typed.

## Optional: test without touching your real Firebase project

Firebase can run a local copy of Authentication, Firestore, and Cloud Functions.

1. In `firebase-config.js`, change `useFirebaseEmulators` from `false` to `true`.
2. In the project terminal, run:

```bash
npx firebase emulators:start
```

3. Keep that terminal running.
4. Open your site using Live Server.
5. Visit `http://127.0.0.1:4000` to see the Firebase Emulator Suite page.
6. When you are done testing, change `useFirebaseEmulators` back to `false`.

## Safety rules to keep

- Keep `firestore.rules` deployed. It blocks visitors from changing product prices and other customers' carts.
- Do not add a rule that says `allow read, write: if true`.
- The website only creates a **fake-payment order**. Add a real payment provider before treating an order as paid.
- Do not put payment keys or service-account files in `firebase-config.js` or browser JavaScript.
- When you edit the 20 products, box prices, or vibe presets, update both `mock-data.js` and `functions/catalog.js` so the browser and server agree. Then increase `catalogVersion` in `functions/index.js` by one to update an existing Firestore catalog.
