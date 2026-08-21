/*
  VARIETY CO. CLOUD FUNCTIONS

  These are the protected server actions for the store.

  A visitor never decides the final pack price. The completeDemoCheckout function
  looks up the approved box price on the server before writing an order.
*/

const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const catalog = require("./catalog");

initializeApp();

const database = getFirestore();

/*
  Increase this number when the server catalog needs to replace an earlier
  catalog. This makes an existing Firestore project update automatically.
*/
const catalogVersion = 3;

setGlobalOptions({
  maxInstances: 10
});

/*
  This function writes the first catalog and upgrades an earlier catalog when
  catalogVersion increases. It does not accept catalog data from a visitor, so
  a visitor cannot use it to change prices or product information.
*/
async function makeSureCatalogExists() {
  const catalogMetadataReference = database
    .collection("catalogMetadata")
    .doc("variety");

  return database.runTransaction(async function (transaction) {
    const catalogMetadataSnapshot = await transaction.get(
      catalogMetadataReference
    );
    let savedCatalogVersion = 0;

    if (catalogMetadataSnapshot.exists) {
      savedCatalogVersion = catalogMetadataSnapshot.data().catalogVersion || 0;
    }

    if (savedCatalogVersion >= catalogVersion) {
      return false;
    }

    /*
      The original fictional product documents stay in Firestore for learning,
      but they are marked inactive so the website shows only the new catalog.
    */
    catalog.previousProductIds.forEach(function (productId) {
      const oldProductReference = database.collection("products").doc(productId);

      transaction.set(oldProductReference, {
        active: false,
        removedFromCatalog: true,
        updatedAt: FieldValue.serverTimestamp()
      }, {
        merge: true
      });
    });

    catalog.products.forEach(function (product) {
      const productReference = database.collection("products").doc(product.id);

      transaction.set(productReference, {
        ...product,
        active: true,
        catalogVersion: catalogVersion,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    Object.keys(catalog.packOptions).forEach(function (packSize) {
      const packReference = database.collection("packOptions").doc(packSize);

      transaction.set(packReference, {
        ...catalog.packOptions[packSize],
        packSize: Number(packSize)
      });
    });

    Object.keys(catalog.vibePresets).forEach(function (vibeName) {
      const vibeReference = database
        .collection("vibePresets")
        .doc(vibeName.toLowerCase().replaceAll(" ", "-"));

      transaction.set(vibeReference, {
        name: vibeName,
        productIds: catalog.vibePresets[vibeName]
      });
    });

    transaction.set(catalogMetadataReference, {
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      catalogVersion: catalogVersion
    }, {
      merge: true
    });

    return true;
  });
}

/*
  The website calls this after Firebase is connected. It is safe to call again:
  it updates the Firestore catalog only when catalogVersion has increased.
*/
exports.initializeCatalog = onCall(
  {
    region: "us-central1"
  },
  async function () {
    const catalogWasCreated = await makeSureCatalogExists();

    return {
      catalogWasCreated: catalogWasCreated,
      catalogVersion: catalogVersion,
      productCount: catalog.products.length
    };
  }
);

/*
  Complete a fake payment and create a demo order record.

  This simulator accepts a single safe test token. It never receives a card
  number, expiry date, CVC, or any other real payment information.
*/
exports.completeDemoCheckout = onCall(
  {
    region: "us-central1"
  },
  async function (request) {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please sign in before creating an order."
      );
    }

    await makeSureCatalogExists();

    const orderRequest = request.data || {};
    const packSize = Number(orderRequest.packSize);
    const selectedProductIds = orderRequest.productIds;
    const selectedVibe = orderRequest.selectedVibe;
    const demoPaymentToken = orderRequest.demoPaymentToken;

    /*
      The browser sends this fixed test token only after it validates the
      prefilled fake card values. No typed card field is sent to this server.
    */
    if (demoPaymentToken !== "variety-test-card-4242") {
      throw new HttpsError(
        "invalid-argument",
        "Use the Variety test payment card to complete this demo checkout."
      );
    }

    if (!Array.isArray(selectedProductIds)) {
      throw new HttpsError(
        "invalid-argument",
        "Your order must include a list of product IDs."
      );
    }

    if (
      packSize !== 6
      && packSize !== 12
      && packSize !== 18
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Please choose a valid Variety pack size."
      );
    }

    const chosenPack = catalog.packOptions[packSize];
    const expectedItemCount = packSize;

    if (selectedProductIds.length !== expectedItemCount) {
      throw new HttpsError(
        "failed-precondition",
        "Fill every spot in your selected pack before creating an order."
      );
    }

    const everyIdIsText = selectedProductIds.every(function (productId) {
      return typeof productId === "string";
    });

    const uniqueProductIds = new Set(selectedProductIds);

    if (
      !everyIdIsText
      || uniqueProductIds.size !== selectedProductIds.length
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Choose each product no more than one time."
      );
    }

    const productReferences = selectedProductIds.map(function (productId) {
      return database.collection("products").doc(productId);
    });

    const productSnapshots = await database.getAll(...productReferences);

    const unavailableProductExists = productSnapshots.some(function (
      productSnapshot
    ) {
      return !productSnapshot.exists || productSnapshot.data().active !== true;
    });

    if (unavailableProductExists) {
      throw new HttpsError(
        "failed-precondition",
        "One or more selected products are no longer available."
      );
    }

    let savedVibeName = "CUSTOM";

    if (
      typeof selectedVibe === "string"
      && catalog.vibePresets[selectedVibe] !== undefined
    ) {
      savedVibeName = selectedVibe;
    }

    const orderReference = database.collection("orders").doc();

    const selectedProducts = productSnapshots.map(function (productSnapshot) {
      const product = productSnapshot.data();

      return {
        id: productSnapshot.id,
        name: product.name,
        category: product.category
      };
    });

    await orderReference.set({
      userId: request.auth.uid,
      productIds: selectedProductIds,
      selectedProducts: selectedProducts,
      packSize: packSize,
      packName: chosenPack.name,
      itemCount: expectedItemCount,
      selectedVibe: savedVibeName,
      totalCents: Math.round(chosenPack.price * 100),
      formattedPrice: "$" + chosenPack.price.toFixed(2),
      currency: "USD",
      orderStatus: "confirmed-demo-order",
      paymentStatus: "paid-test-only",
      fulfillmentStatus: "ready-for-demo-shipping",
      payment: {
        provider: "Variety practice payment",
        method: "test-card",
        lastFour: "4242",
        wasRealPayment: false,
        processedAt: FieldValue.serverTimestamp()
      },
      createdAt: FieldValue.serverTimestamp()
    });

    logger.info("A fake-payment Variety order was created.", {
      orderId: orderReference.id,
      userId: request.auth.uid,
      packSize: packSize
    });

    return {
      orderId: orderReference.id,
      packName: chosenPack.name,
      totalCents: Math.round(chosenPack.price * 100),
      formattedPrice: "$" + chosenPack.price.toFixed(2),
      paymentStatus: "paid-test-only",
      message: "Your test payment was approved and your fake order was saved."
    };
  }
);
