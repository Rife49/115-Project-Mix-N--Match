/*
  FIREBASE BROWSER CONNECTION

  This file connects the existing HTML pages to Firebase without a build tool.
  It uses Firebase's browser modules so this beginner-friendly project can stay
  as plain HTML, CSS, and JavaScript.

  When firebase-config.js still contains placeholder text, this file does
  nothing and the website continues using local storage.
*/

import {
  firebaseConfiguration,
  useFirebaseEmulators
} from "./firebase-config.js";

const firebaseVersion = "12.17.0";

const varietyBackend = {
  isConfigured: false,
  isReady: false,
  isCatalogReady: false,
  status: "local",
  async loadCart() {
    return null;
  },
  async saveCart() {
    return null;
  },
  async loadProducts() {
    return [];
  },
  async completeDemoCheckout() {
    return null;
  }
};

/*
  app.js reads this object. Using one shared object keeps the two JavaScript
  files simple while they load at different times in the browser.
*/
window.varietyBackend = varietyBackend;

function configurationIsComplete() {
  const requiredConfigurationValues = [
    firebaseConfiguration.apiKey,
    firebaseConfiguration.authDomain,
    firebaseConfiguration.projectId,
    firebaseConfiguration.storageBucket,
    firebaseConfiguration.messagingSenderId,
    firebaseConfiguration.appId
  ];

  return requiredConfigurationValues.every(function (value) {
    return typeof value === "string"
      && value !== ""
      && value.indexOf("PASTE_") === -1;
  });
}

function announceBackendReady() {
  window.dispatchEvent(new CustomEvent("variety-backend-ready"));
}

async function waitForExistingUser(authentication, onAuthStateChanged) {
  return new Promise(function (resolve) {
    const stopListening = onAuthStateChanged(authentication, function (user) {
      stopListening();
      resolve(user);
    });
  });
}

async function startFirebase() {
  if (!configurationIsComplete()) {
    announceBackendReady();
    return;
  }

  varietyBackend.isConfigured = true;

  try {
    /*
      Dynamic imports mean the Firebase SDK is downloaded only after the owner
      adds a real Firebase configuration.
    */
    const firebaseAppModule = await import(
      "https://www.gstatic.com/firebasejs/" +
      firebaseVersion +
      "/firebase-app.js"
    );
    const firebaseAuthModule = await import(
      "https://www.gstatic.com/firebasejs/" +
      firebaseVersion +
      "/firebase-auth.js"
    );
    const firebaseFirestoreModule = await import(
      "https://www.gstatic.com/firebasejs/" +
      firebaseVersion +
      "/firebase-firestore.js"
    );
    const firebaseFunctionsModule = await import(
      "https://www.gstatic.com/firebasejs/" +
      firebaseVersion +
      "/firebase-functions.js"
    );

    const firebaseApp = firebaseAppModule.initializeApp(firebaseConfiguration);
    const authentication = firebaseAuthModule.getAuth(firebaseApp);
    const database = firebaseFirestoreModule.getFirestore(firebaseApp);
    const cloudFunctions = firebaseFunctionsModule.getFunctions(
      firebaseApp,
      "us-central1"
    );

    /*
      The emulator switch is off by default. Turn it on in firebase-config.js
      only when you are testing with the local Firebase Emulator Suite.
    */
    if (useFirebaseEmulators === true) {
      firebaseAuthModule.connectAuthEmulator(
        authentication,
        "http://127.0.0.1:9099"
      );
      firebaseFirestoreModule.connectFirestoreEmulator(
        database,
        "127.0.0.1",
        8080
      );
      firebaseFunctionsModule.connectFunctionsEmulator(
        cloudFunctions,
        "127.0.0.1",
        5001
      );
    }

    /*
      The product catalog has public Firestore read rules, so loading it does
      not require Anonymous Authentication. This keeps the product cards live
      even while a visitor is using the local cart fallback.
    */
    varietyBackend.loadProducts = async function () {
      const productsQuery = firebaseFirestoreModule.query(
        firebaseFirestoreModule.collection(database, "products"),
        firebaseFirestoreModule.where("active", "==", true)
      );
      const productSnapshots = await firebaseFirestoreModule.getDocs(
        productsQuery
      );

      return productSnapshots.docs.map(function (productSnapshot) {
        return productSnapshot.data();
      });
    };

    varietyBackend.isCatalogReady = true;

    let currentUser = await waitForExistingUser(
      authentication,
      firebaseAuthModule.onAuthStateChanged
    );

    /*
      Anonymous Authentication gives a first-time visitor a real Firebase ID.
      Later, an account page can upgrade this guest into an email/password user.
    */
    if (currentUser === null) {
      const signInResult = await firebaseAuthModule.signInAnonymously(
        authentication
      );

      currentUser = signInResult.user;
    }

    const userReference = firebaseFirestoreModule.doc(
      database,
      "users",
      currentUser.uid
    );
    const userSnapshot = await firebaseFirestoreModule.getDoc(userReference);

    if (userSnapshot.exists()) {
      await firebaseFirestoreModule.updateDoc(userReference, {
        lastSeenAt: firebaseFirestoreModule.serverTimestamp()
      });
    } else {
      await firebaseFirestoreModule.setDoc(userReference, {
        userId: currentUser.uid,
        email: currentUser.email || "",
        isAnonymous: currentUser.isAnonymous,
        createdAt: firebaseFirestoreModule.serverTimestamp(),
        lastSeenAt: firebaseFirestoreModule.serverTimestamp()
      });
    }

    /*
      The catalog function writes only the hard-coded Variety catalog, one time.
      Calling it here means the very first configured visitor initializes the
      product documents automatically.
    */
    const initializeCatalog = firebaseFunctionsModule.httpsCallable(
      cloudFunctions,
      "initializeCatalog"
    );

    /*
      The catalog is already uploaded to Firestore. This call is useful later
      when Cloud Functions is enabled because it can add catalog updates
      automatically. If the function is unavailable, the website can still
      read the catalog that is already in Firestore.
    */
    try {
      await initializeCatalog();
    } catch (error) {
      console.info(
        "The catalog initializer is unavailable. Using the uploaded Firestore catalog instead."
      );
    }

    varietyBackend.loadCart = async function () {
      const cartReference = firebaseFirestoreModule.doc(
        database,
        "users",
        currentUser.uid,
        "private",
        "cart"
      );
      const cartSnapshot = await firebaseFirestoreModule.getDoc(cartReference);

      if (!cartSnapshot.exists()) {
        return null;
      }

      const cart = cartSnapshot.data();

      return {
        productIds: Array.isArray(cart.productIds) ? cart.productIds : [],
        packSize: cart.packSize,
        selectedVibe: cart.selectedVibe
      };
    };

    varietyBackend.saveCart = async function (cartDetails) {
      const cartReference = firebaseFirestoreModule.doc(
        database,
        "users",
        currentUser.uid,
        "private",
        "cart"
      );

      await firebaseFirestoreModule.setDoc(cartReference, {
        userId: currentUser.uid,
        productIds: cartDetails.productIds,
        packSize: cartDetails.packSize,
        selectedVibe: cartDetails.selectedVibe,
        updatedAt: firebaseFirestoreModule.serverTimestamp()
      });
    };

    varietyBackend.completeDemoCheckout = async function (orderDetails) {
      const completeDemoCheckout = firebaseFunctionsModule.httpsCallable(
        cloudFunctions,
        "completeDemoCheckout"
      );
      const result = await completeDemoCheckout(orderDetails);

      return result.data;
    };

    varietyBackend.isReady = true;
    varietyBackend.status = "connected";
  } catch (error) {
    /*
      The current local-storage demo stays available if Firebase is not yet
      enabled in the Console or the configuration details are incomplete.
    */
    console.warn("Firebase is not fully connected yet.", error);

    if (varietyBackend.isCatalogReady === true) {
      varietyBackend.status = "catalog-connected";
    } else {
      varietyBackend.status = "local";
    }
  }

  announceBackendReady();
}

startFirebase();
