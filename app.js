/*
  APPLICATION LOGIC

  This file makes the website interactive.
  It uses local storage for a quick browser copy and can also use Firebase.

  Local storage is useful for learning. Firebase becomes the online copy after
  the Firebase configuration has been added.
*/

/* ---------- Saved data names ---------- */

const storageKeys = {
  cart: "varietyCart",
  activeUser: "varietyActiveUser",
  buildPack: "varietyBuildPack",
  packSize: "varietyPackSize",
  selectedVibe: "varietySelectedVibe",
  fakeOrders: "varietyFakeOrders",
  account: "varietyAccount",
  previouslyBoughtProducts: "varietyPreviouslyBoughtProducts",
  quickBox: "varietyQuickBox"
};

/*
  The page starts with the local mock products. After Firebase connects,
  Firebase can replace this list with the same products from Cloud Firestore.
*/
let productsForDisplay = mockProducts.slice();

/* ---------- Read and save local data ---------- */

function getSavedData(storageKey, fallbackValue) {
  const savedText = localStorage.getItem(storageKey);

  if (savedText === null) {
    return fallbackValue;
  }

  try {
    return JSON.parse(savedText);
  } catch (error) {
    return fallbackValue;
  }
}

function saveData(storageKey, value) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}

/* ---------- Account and quick reorder data ---------- */

/*
  Firebase Authentication protects the password. Local storage keeps only the
  name and email needed to label this browser's saved History and Quick Box.
*/
function getSignedInAccount() {
  const savedAccount = getSavedData(storageKeys.account, null);

  if (
    savedAccount === null
    || typeof savedAccount.name !== "string"
    || typeof savedAccount.email !== "string"
    || savedAccount.name.trim() === ""
    || savedAccount.email.trim() === ""
  ) {
    return null;
  }

  return savedAccount;
}

/*
  Each email gets its own local-storage key. Replacing symbols keeps the key
  simple to read when you inspect it in your browser developer tools.
*/
function createAccountStorageKey(baseStorageKey) {
  const signedInAccount = getSignedInAccount();

  if (signedInAccount === null) {
    return baseStorageKey + "-guest";
  }

  const emailPart = signedInAccount.email
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  return baseStorageKey + "-" + emailPart;
}

function getPreviouslyBoughtProductIds() {
  const storageKey = createAccountStorageKey(storageKeys.previouslyBoughtProducts);

  return getSavedData(storageKey, []);
}

function savePreviouslyBoughtProductIds(productIds) {
  const storageKey = createAccountStorageKey(storageKeys.previouslyBoughtProducts);

  saveData(storageKey, productIds);
}

/*
  A product only needs to appear once in Previously Bought. The quick box can
  contain the same product more than once when someone wants duplicates.
*/
function saveProductsToPurchaseHistory(productIds) {
  const previouslyBoughtProductIds = getPreviouslyBoughtProductIds();

  productIds.forEach(function (productId) {
    if (previouslyBoughtProductIds.indexOf(productId) === -1) {
      previouslyBoughtProductIds.push(productId);
    }
  });

  savePreviouslyBoughtProductIds(previouslyBoughtProductIds);
}

function getQuickBox() {
  const storageKey = createAccountStorageKey(storageKeys.quickBox);

  return getSavedData(storageKey, []);
}

function saveQuickBox(productIds) {
  const storageKey = createAccountStorageKey(storageKeys.quickBox);

  saveData(storageKey, productIds);
}

/* ---------- Product helper functions ---------- */

function findProductById(productId) {
  for (let index = 0; index < productsForDisplay.length; index += 1) {
    if (productsForDisplay[index].id === productId) {
      return productsForDisplay[index];
    }
  }

  return null;
}

/*
  The Bag, Build Your Pack, and History pages all read from this one catalog.
  Firebase decides which products are available, while the local catalog keeps
  the beginner-friendly product details consistent everywhere on the site.
*/
function findMockProductById(productId) {
  for (let index = 0; index < mockProducts.length; index += 1) {
    if (mockProducts[index].id === productId) {
      return mockProducts[index];
    }
  }

  return null;
}

function addLocalCatalogDetailsToFirebaseProducts(firebaseProducts) {
  return firebaseProducts.map(function (firebaseProduct) {
    const localProduct = findMockProductById(firebaseProduct.id);

    if (localProduct === null) {
      return firebaseProduct;
    }

    /* Copy first so the Firebase product object is not changed directly. */
    const productForDisplay = Object.assign({}, firebaseProduct);

    productForDisplay.imagePath = localProduct.imagePath;
    productForDisplay.brand = localProduct.brand;
    productForDisplay.name = localProduct.name;
    productForDisplay.label = localProduct.label;
    productForDisplay.subtitle = localProduct.subtitle;
    productForDisplay.category = localProduct.category;
    productForDisplay.description = localProduct.description;
    productForDisplay.price = localProduct.price;
    productForDisplay.colorClass = localProduct.colorClass;
    productForDisplay.artShape = localProduct.artShape;
    productForDisplay.artColor = localProduct.artColor;
    productForDisplay.tag = localProduct.tag;
    productForDisplay.tagClass = localProduct.tagClass;

    return productForDisplay;
  });
}

function findProductByName(productName) {
  for (let index = 0; index < productsForDisplay.length; index += 1) {
    if (productsForDisplay[index].name === productName) {
      return productsForDisplay[index];
    }
  }

  return null;
}

function formatPrice(price) {
  return "$" + price.toFixed(2);
}

/* ---------- Message helper ---------- */

function createMessageArea() {
  const message = document.createElement("div");

  message.className = "temporary-message";
  message.setAttribute("data-message", "");
  message.hidden = true;

  document.body.appendChild(message);
}

function showMessage(messageText) {
  const message = document.querySelector("[data-message]");

  if (message === null) {
    return;
  }

  message.textContent = messageText;
  message.hidden = false;

  window.setTimeout(function () {
    message.hidden = true;
  }, 2500);
}

/* ---------- Cart functions ---------- */

function getCart() {
  return getSavedData(storageKeys.cart, []);
}

/*
  Local storage updates the screen immediately. If Firebase is connected,
  this helper also saves the same cart to that visitor's cloud account.
*/
function saveCartToFirebase(cartProductIds) {
  const firebaseBackend = window.varietyBackend;

  if (
    firebaseBackend === undefined
    || firebaseBackend.isReady !== true
  ) {
    return;
  }

  firebaseBackend.saveCart({
    productIds: cartProductIds.slice(),
    packSize: getPackSize(),
    selectedVibe: getSavedData(storageKeys.selectedVibe, "GAME ON")
  }).catch(function (error) {
    console.warn("The cart could not be saved to Firebase.", error);
  });
}

function saveCart(cartProductIds) {
  saveData(storageKeys.cart, cartProductIds);
  saveCartToFirebase(cartProductIds);
  updateCartCount();

  const activeUserName = document.querySelector("[data-active-user-name]");

  if (activeUserName !== null) {
    activeUserName.textContent = getAccountDisplayName();
  }
}

function updateCartCount() {
  const cartCount = getCart().length;
  const cartCountElements = document.querySelectorAll("[data-cart-count]");

  cartCountElements.forEach(function (cartCountElement) {
    cartCountElement.textContent = cartCount;
  });
}

/*
  The cart stores an array of product ids.
  This function counts matching ids so the cart can show quantities.
*/
function createCartRows(cartProductIds) {
  const productCountById = {};
  const cartRows = [];

  cartProductIds.forEach(function (productId) {
    if (productCountById[productId] === undefined) {
      productCountById[productId] = 0;
    }

    productCountById[productId] += 1;
  });

  Object.keys(productCountById).forEach(function (productId) {
    const product = findProductById(productId);

    if (product !== null) {
      cartRows.push({
        product: product,
        quantity: productCountById[productId]
      });
    }
  });

  return cartRows;
}

/*
  The Bag uses the same product image saved in mock-data.js. If an image is
  missing, the colorful product label remains as a simple visual backup.
*/
function createCartProductPicture(product) {
  if (typeof product.imagePath === "string" && product.imagePath !== "") {
    return "<div class=\"cart-item-art cart-item-photo-frame\">" +
      "<img class=\"cart-item-photo\" src=\"" +
      product.imagePath +
      "\" alt=\"" +
      product.name +
      " package\">" +
      "</div>";
  }

  return "<div class=\"cart-item-art " +
    product.colorClass +
    "\">" +
    product.label +
    "</div>";
}

/* The Bag picker changes repeated copies of one product in the current pack. */
function createCartQuantityPicker(product, productQuantity, cartIsFull) {
  const increaseDisabledAttribute = cartIsFull ? " disabled" : "";

  return "<div class=\"account-quantity-picker quantity-picker-has-items cart-item-quantity-picker\" aria-label=\"Quantity for " +
    product.name +
    "\">" +
    "<button type=\"button\" data-decrease-cart-product=\"" +
    product.id +
    "\" aria-label=\"Remove one " +
    product.name +
    " from your Bag\">−</button>" +
    "<span aria-live=\"polite\">" +
    productQuantity +
    "</span>" +
    "<button type=\"button\" data-increase-cart-product=\"" +
    product.id +
    "\" aria-label=\"Add one " +
    product.name +
    " to your Bag\"" +
    increaseDisabledAttribute +
    ">+</button>" +
    "</div>";
}

function renderCartPage() {
  const cartItems = document.querySelector("[data-cart-items]");
  const cartTotal = document.querySelector("[data-cart-total]");
  const cartItemTotal = document.querySelector("[data-cart-item-total]");
  const cartPackName = document.querySelector("[data-cart-pack-name]");

  if (cartItems === null) {
    return;
  }

  const cartProductIds = getCart();
  const cartRows = createCartRows(cartProductIds);
  const packDetails = getPackDetails();

  if (cartRows.length === 0) {
    cartItems.innerHTML =
      "<div class=\"empty-cart\">" +
      "<h2>Your cart is empty.</h2>" +
      "<p>Build a pack to choose snacks and drinks.</p>" +
      "<a href=\"build-pack.html\">BUILD YOUR PACK</a>" +
      "</div>";

    cartTotal.textContent = "$0.00";
    cartItemTotal.textContent = "0 items";

    if (cartPackName !== null) {
      cartPackName.textContent = "Selected pack";
    }
    connectCartButtons();
    return;
  }

  let rowsHtml = "";
  const cartIsFull = cartProductIds.length >= getPackSize();

  cartRows.forEach(function (cartRow) {

    rowsHtml +=
      "<article class=\"cart-item\">" +
      createCartProductPicture(cartRow.product) +
      "<div class=\"cart-item-details\">" +
      "<p>" +
      cartRow.product.category +
      "</p>" +
      "<h2>" +
      cartRow.product.name +
      "</h2>" +
      "<span>" +
      cartRow.product.description +
      "</span>" +
      "</div>" +
      createCartQuantityPicker(
        cartRow.product,
        cartRow.quantity,
        cartIsFull
      ) +
      "</article>";
  });

  cartItems.innerHTML = rowsHtml;
  cartTotal.textContent = formatPrice(packDetails.price);
  cartItemTotal.textContent =
    cartProductIds.length + " items in " + packDetails.name;

  if (cartPackName !== null) {
    cartPackName.textContent = packDetails.name;
  }

  connectCartButtons();
}

function removeOneProductFromCart(productId) {
  const cartProductIds = getCart();
  const productIndex = cartProductIds.indexOf(productId);

  if (productIndex === -1) {
    return;
  }

  cartProductIds.splice(productIndex, 1);
  saveCart(cartProductIds);
  saveData(storageKeys.buildPack, cartProductIds.slice());
  renderCartPage();
}

/* Add one copy in the Bag, without letting the chosen pack become too large. */
function addOneProductToCart(product) {
  const cartProductIds = getCart();

  if (cartProductIds.length >= getPackSize()) {
    showMessage("Your pack is full. Remove an item before adding another.");
    return;
  }

  cartProductIds.push(product.id);
  saveCart(cartProductIds);
  saveData(storageKeys.buildPack, cartProductIds.slice());
  renderCartPage();
  showMessage(product.name + " was added to your Bag.");
}

function cartIsReadyForCheckout() {
  return getCart().length === getPackSize();
}

function updateFakeCheckoutButton() {
  const fakeCheckoutButton = document.querySelector(
    "[data-start-fake-checkout]"
  );

  if (fakeCheckoutButton === null) {
    return;
  }

  fakeCheckoutButton.disabled = !cartIsReadyForCheckout();
}

function connectCartButtons() {
  const decreaseButtons = document.querySelectorAll(
    "[data-decrease-cart-product]"
  );
  const increaseButtons = document.querySelectorAll(
    "[data-increase-cart-product]"
  );
  const clearCartButton = document.querySelector("[data-clear-cart]");

  decreaseButtons.forEach(function (decreaseButton) {
    decreaseButton.addEventListener("click", function () {
      removeOneProductFromCart(
        decreaseButton.getAttribute("data-decrease-cart-product")
      );
    });
  });

  increaseButtons.forEach(function (increaseButton) {
    increaseButton.addEventListener("click", function () {
      const productId = increaseButton.getAttribute("data-increase-cart-product");
      const product = findProductById(productId);

      if (product === null) {
        return;
      }

      addOneProductToCart(product);
    });
  });

  /*
    The summary buttons do not get redrawn when the cart changes. This small
    label prevents the same click listener from being added more than once.
  */
  if (
    clearCartButton !== null
    && clearCartButton.dataset.clickListenerAdded !== "true"
  ) {
    clearCartButton.addEventListener("click", function () {
      saveCart([]);
      saveData(storageKeys.buildPack, []);
      renderCartPage();
      showMessage("Your cart is now empty.");
    });

    clearCartButton.dataset.clickListenerAdded = "true";
  }

  updateFakeCheckoutButton();
}


/* ---------- Fake payment checkout ---------- */

/*
  The fake payment system accepts only the test values shown in cart.html.
  It never saves card fields. A cloud checkout receives only a safe test token.
*/
let fakeCheckoutTriggerButton = null;

function createLocalFakeOrder() {
  const packDetails = getPackDetails();
  const fakeOrders = getSavedData(storageKeys.fakeOrders, []);
  const orderId = "DEMO-" + Date.now().toString().slice(-8);

  const fakeOrder = {
    orderId: orderId,
    productIds: getCart().slice(),
    packName: packDetails.name,
    packSize: getPackSize(),
    formattedPrice: formatPrice(packDetails.price),
    paymentStatus: "paid-test-only",
    paymentMethod: "test-card-ending-4242",
    accountEmail: getSignedInAccount() === null
      ? ""
      : getSignedInAccount().email,
    createdAt: new Date().toISOString()
  };

  fakeOrders.unshift(fakeOrder);
  saveData(storageKeys.fakeOrders, fakeOrders);

  return fakeOrder;
}

function showFakePaymentError(messageText) {
  const errorMessage = document.querySelector("[data-fake-payment-error]");

  if (errorMessage === null) {
    return;
  }

  errorMessage.textContent = messageText;
  errorMessage.hidden = false;
}

function clearFakePaymentError() {
  const errorMessage = document.querySelector("[data-fake-payment-error]");

  if (errorMessage === null) {
    return;
  }

  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function openFakeCheckout() {
  const checkoutModal = document.querySelector("[data-fake-checkout-modal]");
  const packName = document.querySelector("[data-payment-pack-name]");
  const paymentTotal = document.querySelector("[data-payment-total]");
  const paymentFormArea = document.querySelector(
    "[data-fake-payment-form-area]"
  );
  const paymentSuccess = document.querySelector("[data-fake-payment-success]");
  const cardNumberInput = document.querySelector("[data-demo-card-number]");
  const packDetails = getPackDetails();

  if (checkoutModal === null || !cartIsReadyForCheckout()) {
    showMessage("Fill every spot in your pack before you check out.");
    return;
  }

  fakeCheckoutTriggerButton = document.activeElement;
  checkoutModal.hidden = false;
  document.body.classList.add("checkout-modal-open");

  if (packName !== null) {
    packName.textContent = packDetails.name;
  }

  if (paymentTotal !== null) {
    paymentTotal.textContent = formatPrice(packDetails.price);
  }

  if (paymentFormArea !== null) {
    paymentFormArea.hidden = false;
  }

  if (paymentSuccess !== null) {
    paymentSuccess.hidden = true;
  }

  clearFakePaymentError();

  if (cardNumberInput !== null) {
    cardNumberInput.focus();
    cardNumberInput.select();
  }
}

function closeFakeCheckout() {
  const checkoutModal = document.querySelector("[data-fake-checkout-modal]");
  const paymentForm = document.querySelector("[data-fake-payment-form]");
  const paymentFormArea = document.querySelector(
    "[data-fake-payment-form-area]"
  );
  const paymentSuccess = document.querySelector("[data-fake-payment-success]");

  if (checkoutModal === null) {
    return;
  }

  checkoutModal.hidden = true;
  document.body.classList.remove("checkout-modal-open");
  clearFakePaymentError();

  if (paymentForm !== null) {
    paymentForm.reset();
  }

  if (paymentFormArea !== null) {
    paymentFormArea.hidden = false;
  }

  if (paymentSuccess !== null) {
    paymentSuccess.hidden = true;
  }

  if (
    fakeCheckoutTriggerButton !== null
    && typeof fakeCheckoutTriggerButton.focus === "function"
  ) {
    fakeCheckoutTriggerButton.focus();
  }
}

function fakePaymentValuesAreValid() {
  const cardNumberInput = document.querySelector("[data-demo-card-number]");
  const expiryInput = document.querySelector("[data-demo-card-expiry]");
  const cvcInput = document.querySelector("[data-demo-card-cvc]");

  if (
    cardNumberInput === null
    || expiryInput === null
    || cvcInput === null
  ) {
    return false;
  }

  const cardNumber = cardNumberInput.value.replaceAll(" ", "");
  const expiry = expiryInput.value.trim();
  const cvc = cvcInput.value.trim();

  return cardNumber === "4242424242424242"
    && expiry === "12/34"
    && cvc === "123";
}

function showFakePaymentSuccess(order) {
  const paymentFormArea = document.querySelector(
    "[data-fake-payment-form-area]"
  );
  const paymentSuccess = document.querySelector("[data-fake-payment-success]");
  const successfulPaymentTotal = document.querySelector(
    "[data-successful-payment-total]"
  );
  const successfulPaymentOrder = document.querySelector(
    "[data-successful-payment-order]"
  );

  if (paymentFormArea !== null) {
    paymentFormArea.hidden = true;
  }

  if (paymentSuccess !== null) {
    paymentSuccess.hidden = false;
  }

  if (successfulPaymentTotal !== null) {
    successfulPaymentTotal.textContent = order.formattedPrice;
  }

  if (successfulPaymentOrder !== null) {
    successfulPaymentOrder.textContent = order.orderId;
  }
}

async function submitFakePayment(event) {
  event.preventDefault();

  if (!cartIsReadyForCheckout()) {
    showFakePaymentError("Your pack needs every spot filled before checkout.");
    return;
  }

  if (!fakePaymentValuesAreValid()) {
    showFakePaymentError(
      "Use the test values shown: 4242 4242 4242 4242, 12/34, and 123."
    );
    return;
  }

  const paymentButton = document.querySelector("[data-complete-fake-payment]");
  const firebaseBackend = window.varietyBackend;
  const cartProductIds = getCart();
  let completedOrder;

  if (paymentButton !== null) {
    paymentButton.disabled = true;
    paymentButton.textContent = "APPROVING TEST PAYMENT...";
  }

  clearFakePaymentError();

  try {
    if (
      firebaseBackend !== undefined
      && firebaseBackend.isReady === true
    ) {
      try {
        completedOrder = await firebaseBackend.completeDemoCheckout({
          productIds: cartProductIds,
          packSize: getPackSize(),
          selectedVibe: getSavedData(storageKeys.selectedVibe, "GAME ON"),
          demoPaymentToken: "variety-test-card-4242"
        });
      } catch (firebaseCheckoutError) {
        /*
          The demo order can still be saved locally until the optional Firebase
          checkout function is deployed. No real payment details are involved.
        */
        console.info(
          "Firebase checkout is unavailable. Saving this test order locally instead."
        );
        completedOrder = createLocalFakeOrder();
      }
    } else {
      completedOrder = createLocalFakeOrder();
    }

    /*
      Keep the completed products in the local account history. Saving the
      whole finished cart also makes the latest box ready for a future reorder.
    */
    saveProductsToPurchaseHistory(cartProductIds);
    saveQuickBox(cartProductIds);
    saveCart([]);
    saveData(storageKeys.buildPack, []);
    renderCartPage();
    showFakePaymentSuccess(completedOrder);
  } catch (error) {
    showFakePaymentError(
      "The test payment could not be completed. Please try again."
    );
    console.warn("The fake payment could not be completed.", error);
  } finally {
    if (paymentButton !== null) {
      paymentButton.disabled = false;
      paymentButton.textContent = "PAY TEST ORDER";
    }
  }
}

function setupFakePaymentSystem() {
  const openCheckoutButton = document.querySelector(
    "[data-start-fake-checkout]"
  );
  const closeCheckoutButtons = document.querySelectorAll(
    "[data-close-fake-checkout]"
  );
  const paymentForm = document.querySelector("[data-fake-payment-form]");

  if (
    openCheckoutButton === null
    || paymentForm === null
  ) {
    return;
  }

  openCheckoutButton.addEventListener("click", openFakeCheckout);

  closeCheckoutButtons.forEach(function (closeCheckoutButton) {
    closeCheckoutButton.addEventListener("click", closeFakeCheckout);
  });

  paymentForm.addEventListener("submit", submitFakePayment);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeFakeCheckout();
    }
  });
}

/* ---------- Mock user functions ---------- */

function getActiveUser() {
  const activeUserId = getSavedData(storageKeys.activeUser, mockUsers[0].id);

  for (let index = 0; index < mockUsers.length; index += 1) {
    if (mockUsers[index].id === activeUserId) {
      return mockUsers[index];
    }
  }

  return mockUsers[0];
}

function renderUsersPage() {
  const userList = document.querySelector("[data-user-list]");

  if (userList === null) {
    return;
  }

  const activeUser = getActiveUser();
  let userCards = "";

  mockUsers.forEach(function (user) {
    let selectedClass = "";
    let buttonText = "USE THIS USER";

    if (user.id === activeUser.id) {
      selectedClass = " active-user-card";
      buttonText = "ACTIVE USER";
    }

    userCards +=
      "<article class=\"user-card" +
      selectedClass +
      "\">" +
      "<p>MOCK USER</p>" +
      "<h2>" +
      user.name +
      "</h2>" +
      "<span>" +
      user.email +
      "</span>" +
      "<dl>" +
      "<div><dt>Favorite vibe</dt><dd>" +
      user.favoriteVibe +
      "</dd></div>" +
      "<div><dt>Favorite flavor</dt><dd>" +
      user.favoriteFlavor +
      "</dd></div>" +
      "</dl>" +
      "<button type=\"button\" data-select-user=\"" +
      user.id +
      "\">" +
      buttonText +
      "</button>" +
      "</article>";
  });

  userList.innerHTML = userCards;

  const activeUserName = document.querySelector("[data-active-user-name]");

  if (activeUserName !== null) {
    activeUserName.textContent = activeUser.name;
  }

  const userButtons = document.querySelectorAll("[data-select-user]");

  userButtons.forEach(function (userButton) {
    userButton.addEventListener("click", function () {
      saveData(storageKeys.activeUser, userButton.getAttribute("data-select-user"));
      renderUsersPage();
      showMessage("Active user changed.");
    });
  });
}

/* ---------- Account page functions ---------- */

function getAccountDisplayName() {
  const signedInAccount = getSignedInAccount();

  if (signedInAccount === null) {
    return "Guest";
  }

  return signedInAccount.name;
}

function getProductWord(productCount) {
  if (productCount === 1) {
    return "PRODUCT";
  }

  return "PRODUCTS";
}

function createAccountProductImage(product) {
  if (typeof product.imagePath === "string" && product.imagePath !== "") {
    return "<img class=\"account-product-image\" src=\"" +
      product.imagePath +
      "\" alt=\"" +
      product.name +
      "\">";
  }

  return "<div class=\"account-product-placeholder " +
    product.colorClass +
    "\">" +
    product.label +
    "</div>";
}

/* Count one product across the editable Quick Box. */
function countProductInQuickBox(productId, quickBoxProductIds) {
  let productQuantity = 0;

  quickBoxProductIds.forEach(function (quickBoxProductId) {
    if (quickBoxProductId === productId) {
      productQuantity += 1;
    }
  });

  return productQuantity;
}

/* Reuse this small picker in the saved catalog and the Quick Box. */
function createQuickBoxQuantityPicker(product, productQuantity, quickBoxIsFull) {
  const decreaseDisabledAttribute = productQuantity === 0 ? " disabled" : "";
  const increaseDisabledAttribute = quickBoxIsFull ? " disabled" : "";
  const quantityPickerStateClass = productQuantity > 0
    ? " quantity-picker-has-items"
    : "";

  return "<div class=\"account-quantity-picker" +
    quantityPickerStateClass +
    "\" aria-label=\"Quantity for " +
    product.name +
    "\">" +
    "<button type=\"button\" data-decrease-quick-box-product=\"" +
    product.id +
    "\" aria-label=\"Remove one " +
    product.name +
    " from your Quick Box\"" +
    decreaseDisabledAttribute +
    ">−</button>" +
    "<span aria-live=\"polite\">" +
    productQuantity +
    "</span>" +
    "<button type=\"button\" data-increase-quick-box-product=\"" +
    product.id +
    "\" aria-label=\"Add one " +
    product.name +
    " to your Quick Box\"" +
    increaseDisabledAttribute +
    ">+</button>" +
    "</div>";
}

function renderPreviouslyBoughtProducts() {
  const previouslyBoughtList = document.querySelector(
    "[data-previously-bought-list]"
  );
  const previouslyBoughtProductIds = getPreviouslyBoughtProductIds();
  const quickBoxProductIds = getQuickBox();
  const quickBoxIsFull = quickBoxProductIds.length >= getPackSize();

  if (previouslyBoughtList === null) {
    return;
  }

  if (previouslyBoughtProductIds.length === 0) {
    previouslyBoughtList.innerHTML =
      "<div class=\"account-empty-state\">" +
      "<h3>Nothing here yet.</h3>" +
      "<p>Finish a test checkout while signed in, and those products will appear here for your next box.</p>" +
      "<a href=\"build-pack.html\">BUILD A PACK</a>" +
      "</div>";
    return;
  }

  let productCards = "";

  previouslyBoughtProductIds.forEach(function (productId) {
    const product = findProductById(productId);

    if (product === null) {
      return;
    }

    const productQuantity = countProductInQuickBox(
      product.id,
      quickBoxProductIds
    );

    productCards +=
      "<article class=\"account-product\">" +
      createAccountProductImage(product) +
      "<div class=\"account-product-details\">" +
      "<p>" + product.category + "</p>" +
      "<h3>" + product.name + "</h3>" +
      "<span>" + product.description + "</span>" +
      "</div>" +
      "<div class=\"account-product-actions\">" +
      createQuickBoxQuantityPicker(
        product,
        productQuantity,
        quickBoxIsFull
      ) +
      "<button type=\"button\" class=\"account-delete-button\" data-delete-from-history=\"" +
      product.id +
      "\">DELETE</button>" +
      "</div>" +
      "</article>";
  });

  if (productCards === "") {
    previouslyBoughtList.innerHTML =
      "<div class=\"account-empty-state\">" +
      "<h3>Those products are unavailable.</h3>" +
      "<p>Choose new favorites from Build Your Pack.</p>" +
      "<a href=\"build-pack.html\">BUILD A PACK</a>" +
      "</div>";
    return;
  }

  previouslyBoughtList.innerHTML = productCards;
}

function renderQuickBox() {
  const quickBoxList = document.querySelector("[data-quick-box-list]");
  const quickBoxCount = document.querySelector("[data-quick-box-count]");
  const quickBoxStatus = document.querySelector("[data-quick-box-status]");
  const quickCheckoutButton = document.querySelector(
    "[data-go-to-quick-checkout]"
  );
  const quickBoxProductIds = getQuickBox();
  const packSize = getPackSize();
  const packDetails = getPackDetails();

  if (
    quickBoxList === null
    || quickBoxCount === null
    || quickBoxStatus === null
    || quickCheckoutButton === null
  ) {
    return;
  }

  quickBoxCount.textContent = quickBoxProductIds.length + " / " + packSize;
  quickBoxStatus.textContent =
    "Your current box is " + packDetails.name + ".";

  if (quickBoxProductIds.length === 0) {
    quickBoxList.innerHTML =
      "<div class=\"account-empty-state\">" +
      "<h3>Your quick box is empty.</h3>" +
      "<p>Add products from Previously Bought to create your ready-to-go box.</p>" +
      "</div>";
  } else {
    let quickBoxRows = "";
    const shownProductIds = [];
    const quickBoxIsFull = quickBoxProductIds.length >= packSize;

    quickBoxProductIds.forEach(function (productId) {
      const productWasAlreadyShown = shownProductIds.indexOf(productId) !== -1;

      if (productWasAlreadyShown) {
        return;
      }

      shownProductIds.push(productId);

      const product = findProductById(productId);

      if (product === null) {
        return;
      }

      const productQuantity = countProductInQuickBox(
        product.id,
        quickBoxProductIds
      );

      quickBoxRows +=
        "<div class=\"quick-box-item\">" +
        createAccountProductImage(product) +
        "<span>" + product.name + "</span>" +
        createQuickBoxQuantityPicker(
          product,
          productQuantity,
          quickBoxIsFull
        ) +
        "</div>";
    });

    quickBoxList.innerHTML = quickBoxRows;
  }

  if (quickBoxProductIds.length === packSize) {
    quickCheckoutButton.disabled = false;
    quickCheckoutButton.textContent = "GO TO QUICK CHECKOUT";
    return;
  }

  quickCheckoutButton.disabled = true;

  if (quickBoxProductIds.length > packSize) {
    const productsToDelete = quickBoxProductIds.length - packSize;

    quickCheckoutButton.textContent =
      "DELETE " + productsToDelete + " " + getProductWord(productsToDelete);
    return;
  }

  const productsToAdd = packSize - quickBoxProductIds.length;

  quickCheckoutButton.textContent =
    "ADD " + productsToAdd + " MORE " + getProductWord(productsToAdd);
}

function addProductToQuickBox(productId) {
  const quickBoxProductIds = getQuickBox();

  if (quickBoxProductIds.length >= getPackSize()) {
    showMessage("Your quick box is full. Delete an item to make a change.");
    return;
  }

  quickBoxProductIds.push(productId);
  saveQuickBox(quickBoxProductIds);
  renderAccountPage();
  showMessage("Product added to your quick box.");
}

function deleteProductFromPurchaseHistory(productId) {
  const previouslyBoughtProductIds = getPreviouslyBoughtProductIds();
  const productIndex = previouslyBoughtProductIds.indexOf(productId);

  if (productIndex === -1) {
    return;
  }

  previouslyBoughtProductIds.splice(productIndex, 1);
  savePreviouslyBoughtProductIds(previouslyBoughtProductIds);
  renderAccountPage();
  showMessage("Product deleted from Previously Bought.");
}

/* Remove one copy, so the quantity picker can count down one at a time. */
function removeOneProductFromQuickBox(productId) {
  const quickBoxProductIds = getQuickBox();
  const productIndex = quickBoxProductIds.indexOf(productId);

  if (productIndex === -1) {
    return;
  }

  quickBoxProductIds.splice(productIndex, 1);
  saveQuickBox(quickBoxProductIds);
  renderAccountPage();
  showMessage("Product removed from your quick box.");
}

function moveQuickBoxToCart() {
  const quickBoxProductIds = getQuickBox();

  if (quickBoxProductIds.length !== getPackSize()) {
    showMessage("Fill every quick-box spot before checkout.");
    return;
  }

  saveData(storageKeys.buildPack, quickBoxProductIds.slice());
  saveCart(quickBoxProductIds.slice());
  window.location.href = "cart.html";
}

function connectAccountProductButtons() {
  const increaseButtons = document.querySelectorAll(
    "[data-increase-quick-box-product]"
  );
  const decreaseButtons = document.querySelectorAll(
    "[data-decrease-quick-box-product]"
  );
  const historyDeleteButtons = document.querySelectorAll(
    "[data-delete-from-history]"
  );

  increaseButtons.forEach(function (increaseButton) {
    increaseButton.addEventListener("click", function () {
      addProductToQuickBox(
        increaseButton.getAttribute("data-increase-quick-box-product")
      );
    });
  });

  decreaseButtons.forEach(function (decreaseButton) {
    decreaseButton.addEventListener("click", function () {
      removeOneProductFromQuickBox(
        decreaseButton.getAttribute("data-decrease-quick-box-product")
      );
    });
  });

  historyDeleteButtons.forEach(function (deleteButton) {
    deleteButton.addEventListener("click", function () {
      deleteProductFromPurchaseHistory(
        deleteButton.getAttribute("data-delete-from-history")
      );
    });
  });
}

/*
  The account link leads to the same page in both cases. Its label changes so
  signed-in shoppers know it is where their past purchases are kept.
*/
function updateAccountNavigation() {
  const accountNavigationLinks = document.querySelectorAll(
    "[data-account-navigation-link]"
  );
  const signedInAccount = getSignedInAccount();
  let accountLinkLabel = "Sign In";
  let accountLinkDescription = "Sign in to your account";

  if (signedInAccount !== null) {
    accountLinkLabel = "History";
    accountLinkDescription = "Open your account history";
  }

  accountNavigationLinks.forEach(function (accountLink) {
    accountLink.textContent = accountLinkLabel;
    accountLink.setAttribute("aria-label", accountLinkDescription);
  });
}

function renderAccountPage() {
  updateAccountNavigation();
  const signInArea = document.querySelector("[data-account-sign-in-area]");
  const accountDashboard = document.querySelector("[data-account-dashboard]");
  const accountName = document.querySelector("[data-account-name]");
  const signedInAccount = getSignedInAccount();

  if (signInArea === null || accountDashboard === null) {
    return;
  }

  if (signedInAccount === null) {
    signInArea.hidden = false;
    accountDashboard.hidden = true;
    return;
  }

  signInArea.hidden = true;
  accountDashboard.hidden = false;

  if (accountName !== null) {
    accountName.textContent = signedInAccount.name;
  }

  renderPreviouslyBoughtProducts();
  renderQuickBox();
  connectAccountProductButtons();
}

/* Show a helpful, safe message without displaying Firebase's raw error text. */
function getPasswordAccountErrorMessage(error) {
  if (error === undefined || error === null) {
    return "We could not complete that request. Please try again.";
  }

  if (
    error.code === "auth/email-already-in-use"
    || error.code === "auth/credential-already-in-use"
  ) {
    return "That email already has an account. Choose Sign In instead.";
  }

  if (
    error.code === "auth/invalid-credential"
    || error.code === "auth/wrong-password"
    || error.code === "auth/user-not-found"
  ) {
    return "That email or password is not correct. Please try again.";
  }

  if (error.code === "auth/weak-password") {
    return "Choose a stronger password with at least 8 characters.";
  }

  if (error.code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (error.code === "auth/operation-not-allowed") {
    return "Email/password sign-in must be enabled in Firebase Authentication first.";
  }

  if (error.code === "auth/network-request-failed") {
    return "Check your internet connection, then try again.";
  }

  return "We could not complete that request. Please try again.";
}

function showAccountFormMessage(signInForm, messageText) {
  const formMessage = signInForm.querySelector("[data-account-form-message]");

  if (formMessage === null) {
    return;
  }

  formMessage.textContent = messageText;
  formMessage.hidden = false;
}

function clearAccountFormMessage(signInForm) {
  const formMessage = signInForm.querySelector("[data-account-form-message]");

  if (formMessage === null) {
    return;
  }

  formMessage.textContent = "";
  formMessage.hidden = true;
}

/* Switch the same small form between signing in and creating an account. */
function setAccountFormMode(signInForm, formMode) {
  const nameField = signInForm.querySelector("[data-account-name-field]");
  const nameInput = signInForm.querySelector("[data-account-name-input]");
  const passwordInput = signInForm.querySelector(
    "[data-account-password-input]"
  );
  const confirmPasswordField = signInForm.querySelector(
    "[data-account-confirm-password-field]"
  );
  const confirmPasswordInput = signInForm.querySelector(
    "[data-account-confirm-password-input]"
  );
  const modeCopy = signInForm.querySelector("[data-account-mode-copy]");
  const submitButton = signInForm.querySelector("[data-account-submit-button]");
  const modeToggle = signInForm.querySelector("[data-account-mode-toggle]");
  const isCreatingAccount = formMode === "create";

  signInForm.dataset.accountMode = formMode;

  if (nameField !== null) {
    nameField.hidden = !isCreatingAccount;
  }

  if (nameInput !== null) {
    nameInput.required = isCreatingAccount;
  }

  if (passwordInput !== null) {
    passwordInput.autocomplete = isCreatingAccount
      ? "new-password"
      : "current-password";
  }

  if (confirmPasswordField !== null) {
    confirmPasswordField.hidden = !isCreatingAccount;
  }

  if (confirmPasswordInput !== null) {
    confirmPasswordInput.required = isCreatingAccount;
  }

  if (modeCopy !== null) {
    modeCopy.textContent = isCreatingAccount
      ? "Create an account to keep your favorites with your email and password."
      : "Sign in with the email address and password for your Variety account.";
  }

  if (submitButton !== null) {
    submitButton.textContent = isCreatingAccount
      ? "CREATE ACCOUNT"
      : "SIGN IN";
  }

  if (modeToggle !== null) {
    modeToggle.textContent = isCreatingAccount
      ? "I ALREADY HAVE AN ACCOUNT"
      : "CREATE AN ACCOUNT";
  }

  clearAccountFormMessage(signInForm);
}

/* Firebase provides the display name. This fallback is used for older accounts. */
function getAccountNameFromEmail(emailAddress) {
  const emailParts = emailAddress.split("@");

  if (emailParts[0] === undefined || emailParts[0] === "") {
    return "Friend";
  }

  return emailParts[0];
}

function setupAccountPage() {
  const signInForm = document.querySelector("[data-account-sign-in-form]");
  const signOutButton = document.querySelector("[data-account-sign-out]");
  const quickCheckoutButton = document.querySelector(
    "[data-go-to-quick-checkout]"
  );

  if (signInForm === null) {
    return;
  }

  const modeToggle = signInForm.querySelector("[data-account-mode-toggle]");

  setAccountFormMode(signInForm, "sign-in");

  if (modeToggle !== null) {
    modeToggle.addEventListener("click", function () {
      const currentMode = signInForm.dataset.accountMode;
      const nextMode = currentMode === "create" ? "sign-in" : "create";

      setAccountFormMode(signInForm, nextMode);
    });
  }

  signInForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nameInput = signInForm.querySelector("[data-account-name-input]");
    const emailInput = signInForm.querySelector("[data-account-email-input]");
    const passwordInput = signInForm.querySelector(
      "[data-account-password-input]"
    );
    const confirmPasswordInput = signInForm.querySelector(
      "[data-account-confirm-password-input]"
    );
    const submitButton = signInForm.querySelector("[data-account-submit-button]");
    const formMode = signInForm.dataset.accountMode;
    const firebaseBackend = window.varietyBackend;

    if (emailInput === null || passwordInput === null || submitButton === null) {
      return;
    }

    if (firebaseBackend === undefined || firebaseBackend.isReady !== true) {
      showAccountFormMessage(
        signInForm,
        "Password sign-in is not connected yet. Please refresh and try again."
      );
      return;
    }

    const emailAddress = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const accountName = nameInput === null ? "" : nameInput.value.trim();
    const confirmedPassword = confirmPasswordInput === null
      ? ""
      : confirmPasswordInput.value;

    if (formMode === "create" && accountName === "") {
      showAccountFormMessage(signInForm, "Enter your name to create an account.");
      return;
    }

    if (formMode === "create" && password !== confirmedPassword) {
      showAccountFormMessage(signInForm, "Your passwords do not match.");
      return;
    }

    submitButton.disabled = true;

    if (modeToggle !== null) {
      modeToggle.disabled = true;
    }

    clearAccountFormMessage(signInForm);

    try {
      let firebaseAccount;

      if (formMode === "create") {
        firebaseAccount = await firebaseBackend.createPasswordAccount({
          name: accountName,
          email: emailAddress,
          password: password
        });
      } else {
        firebaseAccount = await firebaseBackend.signInWithPassword({
          email: emailAddress,
          password: password
        });
      }

      const savedName = typeof firebaseAccount.name === "string"
        && firebaseAccount.name !== ""
        ? firebaseAccount.name
        : getAccountNameFromEmail(emailAddress);

      saveData(storageKeys.account, {
        name: savedName,
        email: firebaseAccount.email
      });

      signInForm.reset();
      setAccountFormMode(signInForm, "sign-in");
      renderAccountPage();
      loadFirebaseData();

      showMessage(
        formMode === "create"
          ? "Your Variety account is ready."
          : "You are signed in. Your saved lists are ready."
      );
    } catch (error) {
      showAccountFormMessage(signInForm, getPasswordAccountErrorMessage(error));
    } finally {
      submitButton.disabled = false;

      if (modeToggle !== null) {
        modeToggle.disabled = false;
      }
    }
  });

  if (signOutButton !== null) {
    signOutButton.addEventListener("click", async function () {
      const firebaseBackend = window.varietyBackend;

      if (
        firebaseBackend !== undefined
        && firebaseBackend.isReady === true
        && typeof firebaseBackend.signOutPasswordAccount === "function"
      ) {
        try {
          await firebaseBackend.signOutPasswordAccount();
        } catch (error) {
          showMessage("We could not sign you out. Please try again.");
          return;
        }
      }

      localStorage.removeItem(storageKeys.account);
      renderAccountPage();
      showMessage("You are signed out on this browser.");
    });
  }

  if (quickCheckoutButton !== null) {
    quickCheckoutButton.addEventListener("click", moveQuickBoxToCart);
  }
}

/* ---------- Build Your Pack functions ---------- */

function getBuildPack() {
  return getSavedData(storageKeys.buildPack, []);
}

function getPackSize() {
  return getSavedData(storageKeys.packSize, 6);
}

/* Keep the saved products within the capacity of the currently selected box. */
function trimBuildPackToSelectedSize() {
  const selectedProductIds = getBuildPack();
  const packSize = getPackSize();

  if (selectedProductIds.length <= packSize) {
    return false;
  }

  /* slice() keeps the first products and removes only the extras. */
  const productsThatFit = selectedProductIds.slice(0, packSize);

  saveData(storageKeys.buildPack, productsThatFit);

  return true;
}

/* Return the name, item label, and price for the selected box size. */
function getPackDetails() {
  const packSize = getPackSize();

  if (packOptions[packSize] !== undefined) {
    return packOptions[packSize];
  }

  return packOptions[6];
}

/* Use title case in the summary, while the vibe buttons can stay all caps. */
function getFriendlyVibeName() {
  const savedVibeName = getSavedData(storageKeys.selectedVibe, "GAME ON");
  const friendlyVibeNames = {
    "GAME ON": "Game On",
    "MOVIE NIGHT": "Movie Night",
    "GAME DAY": "Game Day",
    "ALL-NIGHTER": "All-Nighter",
    "CHILL MODE": "Chill Mode"
  };

  if (friendlyVibeNames[savedVibeName] !== undefined) {
    return friendlyVibeNames[savedVibeName];
  }

  return savedVibeName;
}

/*
  Build Your Pack uses the product objects in mock-data.js.
  This means you can add a product in one file and it will appear here.
*/
function createBuildPackProductTag(product) {
  let tagClass = "";

  if (product.tag === "") {
    return "";
  }

  if (product.tagClass !== "") {
    tagClass = " " + product.tagClass;
  }

  return "<span class=\"product-tag" + tagClass + "\">" + product.tag + "</span>";
}

/*
  Use the product photo when the catalog includes one. The older CSS artwork
  stays as a simple backup while a catalog item is missing its photo path.
*/
function createBuildPackProductArt(product) {
  if (typeof product.imagePath === "string" && product.imagePath !== "") {
    return "<div class=\"product-art product-photo\">" +
      "<img class=\"product-image\" src=\"" +
      product.imagePath +
      "\" alt=\"" +
      product.name +
      "\">" +
      "</div>";
  }

  return "<div class=\"product-art " +
    product.artShape +
    " " +
    product.artColor +
    "\">" +
    product.label +
    "<small>" +
    product.subtitle +
    "</small>" +
    "</div>";
}

/*
  Put each product into one easy-to-find row. Drinks can have several catalog
  category names, but they all belong together in the Drinks row.
*/
function getBuildPackCategoryName(product) {
  const drinkCategories = [
    "ENERGY DRINK",
    "HYDRATION",
    "SPORTS DRINK",
    "WATER",
    "SODA",
    "SPARKLING WATER"
  ];

  if (drinkCategories.indexOf(product.category) !== -1) {
    return "drinks";
  }

  if (product.category === "CANDY") {
    return "candy";
  }

  return "snacks";
}

/*
  This function creates one card. Keeping it separate makes it easier to see
  that the product layout is unchanged even though the cards are now grouped.
*/
function createBuildPackProductCard(product) {
  return "<article class=\"product-card\" data-build-product-card-id=\"" +
    product.id +
    "\">" +
    createBuildPackProductTag(product) +
    createBuildPackProductArt(product) +
    "<div class=\"product-info\">" +
    "<p>" +
    product.category +
    "</p>" +
    "<h3>" +
    product.name +
    "</h3>" +
    "<span>" +
    product.description +
    "</span>" +
    "<div class=\"product-quantity-picker\" aria-label=\"Quantity for " +
    product.name +
    "\">" +
    "<button type=\"button\" data-decrease-product-id=\"" +
    product.id +
    "\" aria-label=\"Remove one " +
    product.name +
    "\" disabled>−</button>" +
    "<span data-build-product-quantity aria-live=\"polite\">0</span>" +
    "<button type=\"button\" data-increase-product-id=\"" +
    product.id +
    "\" aria-label=\"Add one " +
    product.name +
    "\">+</button>" +
    "</div>" +
    "</div>" +
    "</article>";
}

/* Create one labeled row with its own product grid. */
function createBuildPackCategoryRow(categoryDetails, products) {
  let productCards = "";

  products.forEach(function (product) {
    productCards += createBuildPackProductCard(product);
  });

  return "<section class=\"product-category-row product-category-" +
    categoryDetails.name +
    "\" aria-labelledby=\"build-category-" +
    categoryDetails.name +
    "\">" +
    "<div class=\"product-category-heading\">" +
    "<div>" +
    "<span class=\"product-category-number\">" +
    categoryDetails.number +
    "</span>" +
    "<h3 id=\"build-category-" +
    categoryDetails.name +
    "\">" +
    categoryDetails.title +
    "</h3>" +
    "</div>" +
    "<p>" +
    categoryDetails.description +
    "</p>" +
    "</div>" +
    "<div class=\"product-grid\">" +
    productCards +
    "</div>" +
    "</section>";
}

function renderBuildPackProducts() {
  const productList = document.querySelector("[data-build-product-list]");

  if (productList === null) {
    return;
  }

  /* This list controls the order visitors see: drinks, snacks, then candy. */
  const productCategories = [
    {
      name: "drinks",
      number: "01",
      title: "DRINKS",
      description: "Energy, hydration, and refreshing drinks."
    },
    {
      name: "snacks",
      number: "02",
      title: "SNACKS",
      description: "Crunchy, savory, and better-for-you favorites."
    },
    {
      name: "candy",
      number: "03",
      title: "CANDY",
      description: "Sweet treats for the perfect finish."
    }
  ];
  const productsByCategory = {
    drinks: [],
    snacks: [],
    candy: []
  };

  productsForDisplay.forEach(function (product) {
    const categoryName = getBuildPackCategoryName(product);

    productsByCategory[categoryName].push(product);
  });

  let categoryRows = "";

  productCategories.forEach(function (categoryDetails) {
    const productsInThisCategory = productsByCategory[categoryDetails.name];

    categoryRows += createBuildPackCategoryRow(
      categoryDetails,
      productsInThisCategory
    );
  });

  productList.innerHTML = categoryRows;
}

/*
  Update every product card after the visitor adds or removes an item.
  closest() finds the card that contains the button that was clicked.
*/
/* Count repeated product ids so every card can show its own quantity. */
function countProductInBuildPack(productId, selectedProductIds) {
  let productQuantity = 0;

  selectedProductIds.forEach(function (selectedProductId) {
    if (selectedProductId === productId) {
      productQuantity += 1;
    }
  });

  return productQuantity;
}

/* Update the number and button state in every product quantity picker. */
function updateBuildProductCards() {
  const selectedProductIds = getBuildPack();
  const packIsFull = selectedProductIds.length >= getPackSize();
  const productCards = document.querySelectorAll("[data-build-product-card-id]");

  productCards.forEach(function (productCard) {
    const productId = productCard.getAttribute("data-build-product-card-id");
    const productQuantity = countProductInBuildPack(
      productId,
      selectedProductIds
    );
    const quantityDisplay = productCard.querySelector(
      "[data-build-product-quantity]"
    );
    const decreaseButton = productCard.querySelector(
      "[data-decrease-product-id]"
    );
    const increaseButton = productCard.querySelector(
      "[data-increase-product-id]"
    );

    if (quantityDisplay !== null) {
      quantityDisplay.textContent = productQuantity;
    }

    if (decreaseButton !== null) {
      decreaseButton.disabled = productQuantity === 0;
    }

    if (increaseButton !== null) {
      increaseButton.disabled = packIsFull;
    }

    if (productQuantity > 0) {
      productCard.classList.add("selected-product-card");
    } else {
      productCard.classList.remove("selected-product-card");
    }
  });
}

/*
  The editable pack and the Bag cart use the same product ids.
  This keeps both areas in sync when a visitor adds or removes an item.
*/
function syncCartWithBuildPack() {
  const selectedProductIds = getBuildPack();

  saveCart(selectedProductIds.slice());
}

function updateBuildPackPage() {
  const selectedProductIds = getBuildPack();
  const selectedCount = selectedProductIds.length;
  const packSize = getPackSize();
  const packDetails = getPackDetails();
  const packCounter = document.querySelector(".fill-counter strong");
  const packCapacity = document.querySelector("[data-pack-fill-capacity]");
  const packNameHeading = document.querySelector("[data-pack-name]");
  const packSummaryName = document.querySelector("[data-pack-summary-name]");
  const packSummaryPrice = document.querySelector("[data-pack-summary-price]");
  const summaryCount = document.querySelector(".summary-head > span");
  const summaryVibe = document.querySelector(".summary-sub");
  const summaryMessage = document.querySelector("[data-pack-summary-message]");
  const summaryHelper = document.querySelector("[data-pack-summary-helper]");
  const friendlyVibeName = getFriendlyVibeName();
  const progressBar = document.querySelector(".summary-progress span");
  const checkoutButton = document.querySelector(".checkout-button");

  if (packCounter !== null) {
    packCounter.textContent = selectedCount;
  }

  if (packCapacity !== null) {
    packCapacity.textContent = packSize;
  }

  if (summaryCount !== null) {
    summaryCount.textContent = selectedCount + " / " + packSize;
  }

  if (packNameHeading !== null) {
    packNameHeading.textContent = packDetails.name;
  }

  if (packSummaryName !== null) {
    packSummaryName.textContent = packDetails.itemCountLabel;
  }

  if (packSummaryPrice !== null) {
    packSummaryPrice.textContent = formatPrice(packDetails.price);
  }

  if (summaryVibe !== null) {
    summaryVibe.textContent = friendlyVibeName + " pack";
  }

  if (summaryMessage !== null) {
    summaryMessage.textContent =
      "Choose " + packSize + " to start your " + friendlyVibeName + ".";
  }

  if (summaryHelper !== null) {
    if (selectedCount >= packSize) {
      summaryHelper.textContent = packDetails.name + " is ready to check out.";
    } else {
      const remainingItems = packSize - selectedCount;
      const favoriteWord = remainingItems === 1 ? "favorite" : "favorites";

      summaryHelper.textContent =
        "Add " + remainingItems + " more " + favoriteWord + " to complete your box.";
    }
  }

  if (progressBar !== null) {
    /* The red progress line should never be wider than the summary card. */
    const progressPercentage = Math.min((selectedCount / packSize) * 100, 100);

    progressBar.style.width = progressPercentage + "%";
  }

  if (checkoutButton !== null) {
    checkoutButton.disabled = false;

    if (selectedCount >= packSize) {
      checkoutButton.textContent = "VIEW YOUR CART";
    } else {
      checkoutButton.textContent =
        "ADD " + (packSize - selectedCount) + " MORE ITEMS";
    }
  }

  updateBuildProductCards();
}

/* Add one copy of a product, as long as the selected box has room. */
function addOneProductToBuildPack(product) {
  const selectedProductIds = getBuildPack();

  if (selectedProductIds.length >= getPackSize()) {
    showMessage("Your pack is full. Remove an item to add something else.");
    return;
  }

  selectedProductIds.push(product.id);
  saveData(storageKeys.buildPack, selectedProductIds);
  syncCartWithBuildPack();
  updateBuildPackPage();
  showMessage(product.name + " was added to your pack.");
}

/* Remove one copy of a product, while leaving any other copies in the pack. */
function removeOneProductFromBuildPack(product) {
  const selectedProductIds = getBuildPack();
  const productIndex = selectedProductIds.indexOf(product.id);

  if (productIndex === -1) {
    return;
  }

  selectedProductIds.splice(productIndex, 1);
  saveData(storageKeys.buildPack, selectedProductIds);
  syncCartWithBuildPack();
  updateBuildPackPage();
  showMessage(product.name + " was removed from your pack.");
}

/*
  Product cards are redrawn after Firebase loads, so these listeners are
  connected again after each redraw.
*/
function connectBuildProductQuantityPickers() {
  const increaseButtons = document.querySelectorAll(
    "[data-increase-product-id]"
  );
  const decreaseButtons = document.querySelectorAll(
    "[data-decrease-product-id]"
  );

  increaseButtons.forEach(function (increaseButton) {
    const productId = increaseButton.getAttribute("data-increase-product-id");
    const product = findProductById(productId);

    if (product !== null) {
      increaseButton.addEventListener("click", function () {
        addOneProductToBuildPack(product);
      });
    }
  });

  decreaseButtons.forEach(function (decreaseButton) {
    const productId = decreaseButton.getAttribute("data-decrease-product-id");
    const product = findProductById(productId);

    if (product !== null) {
      decreaseButton.addEventListener("click", function () {
        removeOneProductFromBuildPack(product);
      });
    }
  });
}

/*
  Each mood begins with six matching favorites. This repeats that set until it
  fills the selected 6-, 12-, or 18-item box. The quantity pickers then make
  those repeated items easy to change.
*/
function createVibePackForSelectedSize(vibeName) {
  const vibePreset = vibePresets[vibeName];

  if (vibePreset === undefined || vibePreset.length === 0) {
    return null;
  }

  const selectedPackSize = getPackSize();
  const sizedVibePack = [];

  for (let itemIndex = 0; itemIndex < selectedPackSize; itemIndex += 1) {
    const presetItemIndex = itemIndex % vibePreset.length;

    sizedVibePack.push(vibePreset[presetItemIndex]);
  }

  return sizedVibePack;
}

/* Make the red selected outline follow the currently chosen pack size. */
function updateSelectedPackSizeCards() {
  const sizeCards = document.querySelectorAll(".size-card");
  const packSizes = [6, 12, 18];
  const selectedPackSize = getPackSize();

  sizeCards.forEach(function (sizeCard, cardIndex) {
    const sizeInput = sizeCard.querySelector("input");
    const isSelectedSize = packSizes[cardIndex] === selectedPackSize;

    if (isSelectedSize) {
      sizeCard.classList.add("selected");
    } else {
      sizeCard.classList.remove("selected");
    }

    if (sizeInput !== null) {
      sizeInput.checked = isSelectedSize;
    }
  });
}

function setupBuilderPage() {
  const sizeCards = document.querySelectorAll(".size-card");
  const vibeButtons = document.querySelectorAll(".vibe-card");
  const checkoutButton = document.querySelector(".checkout-button");

  if (sizeCards.length === 0) {
    return;
  }

  const packSizes = [6, 12, 18];
  const savedVibeName = getSavedData(storageKeys.selectedVibe, "GAME ON");
  const savedPackWasTrimmed = trimBuildPackToSelectedSize();

  if (savedPackWasTrimmed) {
    syncCartWithBuildPack();
  }

  /* Restore the selected vibe style after the page refreshes. */
  vibeButtons.forEach(function (vibeButton) {
    const vibeName = vibeButton.querySelector("strong").textContent;

    if (vibeName === savedVibeName) {
      vibeButton.classList.add("active");
    } else {
      vibeButton.classList.remove("active");
    }
  });

  updateSelectedPackSizeCards();

  sizeCards.forEach(function (sizeCard, cardIndex) {
    sizeCard.addEventListener("click", function () {
      saveData(storageKeys.packSize, packSizes[cardIndex]);

      const packWasTrimmed = trimBuildPackToSelectedSize();

      syncCartWithBuildPack();
      updateSelectedPackSizeCards();
      updateBuildPackPage();

      if (packWasTrimmed) {
        showMessage(
          "Your products were adjusted to fit " + getPackDetails().name + "."
        );
      }
    });
  });

  vibeButtons.forEach(function (vibeButton) {
    vibeButton.addEventListener("click", function () {
      const vibeName = vibeButton.querySelector("strong").textContent;
      const starterPack = createVibePackForSelectedSize(vibeName);

      if (starterPack === null) {
        return;
      }

      saveData(storageKeys.selectedVibe, vibeName);

      /*
        slice() makes a new array. This lets a visitor change their pack
        without accidentally changing the original preset in mock-data.js.
      */
      saveData(storageKeys.buildPack, starterPack.slice());
      syncCartWithBuildPack();

      vibeButtons.forEach(function (otherVibeButton) {
        otherVibeButton.classList.remove("active");
      });

      vibeButton.classList.add("active");
      updateBuildPackPage();
      showMessage(
        getPackSize() + "-item " + getFriendlyVibeName() +
        " starter pack loaded. Add or remove anything you want."
      );
    });
  });

  if (checkoutButton !== null) {
    checkoutButton.addEventListener("click", function () {
      const selectedProductIds = getBuildPack();

      if (selectedProductIds.length >= getPackSize()) {
        syncCartWithBuildPack();
        window.location.href = "cart.html";
      } else {
        showMessage("Choose more products to finish your pack.");
      }
    });
  }

  updateBuildPackPage();
}

/* ---------- Navigation and application start ---------- */

function setupCartNavigation() {
  const cartButtons = document.querySelectorAll(
    ".pack-nav-actions button[aria-label=\"Shopping bag\"]"
  );

  cartButtons.forEach(function (cartButton) {
    cartButton.addEventListener("click", function () {
      window.location.href = "cart.html";
    });
  });
}

/*
  Load the public Firebase catalog as soon as it is available.
  If Firebase sign-in also succeeds, the visitor's cloud cart is then copied into
  local storage so it remains a quick page cache.
*/
async function loadFirebaseData() {
  const firebaseBackend = window.varietyBackend;

  if (
    firebaseBackend === undefined
    || firebaseBackend.isCatalogReady !== true
  ) {
    return;
  }

  try {
    const firebaseProducts = await firebaseBackend.loadProducts();

    if (firebaseProducts.length > 0) {
      productsForDisplay = addLocalCatalogDetailsToFirebaseProducts(
        firebaseProducts
      );
      renderBuildPackProducts();
      connectBuildProductQuantityPickers();
      updateBuildPackPage();
      renderCartPage();
      renderAccountPage();
    }

    /*
      A public catalog can load without a signed-in Firebase user. Cart data
      needs sign-in, so it continues using local storage until that is ready.
    */
    if (firebaseBackend.isReady !== true) {
      return;
    }

    const firebaseCart = await firebaseBackend.loadCart();

    if (firebaseCart === null) {
      /*
        A first-time Firebase visitor keeps the pack they already built locally.
        saveCart() sends that starting pack to their new cloud cart.
      */
      saveCart(getCart());
      return;
    }

    saveData(storageKeys.cart, firebaseCart.productIds);
    saveData(storageKeys.buildPack, firebaseCart.productIds.slice());

    if (
      firebaseCart.packSize === 6
      || firebaseCart.packSize === 12
      || firebaseCart.packSize === 18
    ) {
      saveData(storageKeys.packSize, firebaseCart.packSize);
    }

    if (typeof firebaseCart.selectedVibe === "string") {
      saveData(storageKeys.selectedVibe, firebaseCart.selectedVibe);
    }

    const firebasePackWasTrimmed = trimBuildPackToSelectedSize();

    if (firebasePackWasTrimmed) {
      syncCartWithBuildPack();
    }

    updateSelectedPackSizeCards();
    updateCartCount();
    renderCartPage();
    updateBuildPackPage();
    renderAccountPage();
  } catch (error) {
    console.warn("Firebase data could not be loaded.", error);
  }
}

function startApplication() {
  createMessageArea();
  setupFakePaymentSystem();
  updateCartCount();

  const activeUserName = document.querySelector("[data-active-user-name]");

  if (activeUserName !== null) {
    activeUserName.textContent = getAccountDisplayName();
  }
  setupCartNavigation();
  renderCartPage();
  renderUsersPage();
  setupAccountPage();
  renderAccountPage();
  renderBuildPackProducts();
  connectBuildProductQuantityPickers();
  setupBuilderPage();
  loadFirebaseData();
}

/*
  Firebase can finish connecting before or after the regular page setup.
  Listening for this event covers both cases.
*/
window.addEventListener("variety-backend-ready", loadFirebaseData);

document.addEventListener("DOMContentLoaded", startApplication);
