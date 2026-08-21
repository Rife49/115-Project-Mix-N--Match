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

/* ---------- Learning account and quick reorder data ---------- */

/*
  This is a browser-only learning account, not a password system. The name and
  email help us give each person using this browser their own saved lists.
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
  The live Firebase catalog can be older than the local learning catalog.
  This adds a local product photo path only when a live product does not have
  one yet. When Firebase receives the newest catalog, it keeps its own path.
*/
function findMockProductById(productId) {
  for (let index = 0; index < mockProducts.length; index += 1) {
    if (mockProducts[index].id === productId) {
      return mockProducts[index];
    }
  }

  return null;
}

function addLocalImagePathsToFirebaseProducts(firebaseProducts) {
  return firebaseProducts.map(function (firebaseProduct) {
    const localProduct = findMockProductById(firebaseProduct.id);
    const firebaseHasImagePath = typeof firebaseProduct.imagePath === "string"
      && firebaseProduct.imagePath !== "";

    if (localProduct === null || firebaseHasImagePath) {
      return firebaseProduct;
    }

    firebaseProduct.imagePath = localProduct.imagePath;

    return firebaseProduct;
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

  cartRows.forEach(function (cartRow) {

    rowsHtml +=
      "<article class=\"cart-item\">" +
      "<div class=\"cart-item-art " +
      cartRow.product.colorClass +
      "\">" +
      cartRow.product.label +
      "</div>" +
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
      "<div class=\"cart-item-quantity\">Qty: " +
      cartRow.quantity +
      "</div>" +
      "<button type=\"button\" data-remove-product=\"" +
      cartRow.product.id +
      "\">Remove one</button>" +
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
  const removeButtons = document.querySelectorAll("[data-remove-product]");
  const clearCartButton = document.querySelector("[data-clear-cart]");

  removeButtons.forEach(function (removeButton) {
    removeButton.addEventListener("click", function () {
      removeOneProductFromCart(removeButton.getAttribute("data-remove-product"));
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

function renderPreviouslyBoughtProducts() {
  const previouslyBoughtList = document.querySelector(
    "[data-previously-bought-list]"
  );
  const previouslyBoughtProductIds = getPreviouslyBoughtProductIds();

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

    productCards +=
      "<article class=\"account-product\">" +
      createAccountProductImage(product) +
      "<div class=\"account-product-details\">" +
      "<p>" + product.category + "</p>" +
      "<h3>" + product.name + "</h3>" +
      "<span>" + product.description + "</span>" +
      "</div>" +
      "<div class=\"account-product-actions\">" +
      "<button type=\"button\" class=\"account-add-button\" data-add-to-quick-box=\"" +
      product.id +
      "\">ADD</button>" +
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

    quickBoxProductIds.forEach(function (productId, productIndex) {
      const product = findProductById(productId);

      if (product === null) {
        return;
      }

      quickBoxRows +=
        "<div class=\"quick-box-item\">" +
        createAccountProductImage(product) +
        "<span>" + product.name + "</span>" +
        "<button type=\"button\" data-delete-from-quick-box=\"" +
        productIndex +
        "\">DELETE</button>" +
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

function deleteProductFromQuickBox(productIndex) {
  const quickBoxProductIds = getQuickBox();

  if (productIndex < 0 || productIndex >= quickBoxProductIds.length) {
    return;
  }

  quickBoxProductIds.splice(productIndex, 1);
  saveQuickBox(quickBoxProductIds);
  renderAccountPage();
  showMessage("Product deleted from your quick box.");
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
  const addButtons = document.querySelectorAll("[data-add-to-quick-box]");
  const historyDeleteButtons = document.querySelectorAll(
    "[data-delete-from-history]"
  );
  const quickBoxDeleteButtons = document.querySelectorAll(
    "[data-delete-from-quick-box]"
  );

  addButtons.forEach(function (addButton) {
    addButton.addEventListener("click", function () {
      addProductToQuickBox(addButton.getAttribute("data-add-to-quick-box"));
    });
  });

  historyDeleteButtons.forEach(function (deleteButton) {
    deleteButton.addEventListener("click", function () {
      deleteProductFromPurchaseHistory(
        deleteButton.getAttribute("data-delete-from-history")
      );
    });
  });

  quickBoxDeleteButtons.forEach(function (deleteButton) {
    deleteButton.addEventListener("click", function () {
      deleteProductFromQuickBox(
        Number(deleteButton.getAttribute("data-delete-from-quick-box"))
      );
    });
  });
}

function renderAccountPage() {
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

function setupAccountPage() {
  const signInForm = document.querySelector("[data-account-sign-in-form]");
  const signOutButton = document.querySelector("[data-account-sign-out]");
  const quickCheckoutButton = document.querySelector(
    "[data-go-to-quick-checkout]"
  );

  if (signInForm === null) {
    return;
  }

  signInForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const nameInput = document.querySelector("[data-account-name-input]");
    const emailInput = document.querySelector("[data-account-email-input]");

    if (nameInput === null || emailInput === null) {
      return;
    }

    saveData(storageKeys.account, {
      name: nameInput.value.trim(),
      email: emailInput.value.trim().toLowerCase()
    });

    signInForm.reset();
    renderAccountPage();
    showMessage("You are signed in. Your saved lists are ready.");
  });

  if (signOutButton !== null) {
    signOutButton.addEventListener("click", function () {
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

/* Return the name, item label, and price for the selected box size. */
function getPackDetails() {
  const packSize = getPackSize();

  if (packOptions[packSize] !== undefined) {
    return packOptions[packSize];
  }

  return packOptions[6];
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

function renderBuildPackProducts() {
  const productList = document.querySelector("[data-build-product-list]");

  if (productList === null) {
    return;
  }

  let productCards = "";

  productsForDisplay.forEach(function (product) {
    productCards +=
      "<article class=\"product-card\">" +
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
      "<button type=\"button\" data-build-product-id=\"" +
      product.id +
      "\" aria-label=\"Add " +
      product.name +
      "\" aria-pressed=\"false\">+</button>" +
      "</div>" +
      "</article>";
  });

  productList.innerHTML = productCards;
}

/*
  Update every product card after the visitor adds or removes an item.
  closest() finds the card that contains the button that was clicked.
*/
function updateBuildProductCards() {
  const selectedProductIds = getBuildPack();
  const productButtons = document.querySelectorAll("[data-build-product-id]");

  productButtons.forEach(function (productButton) {
    const productId = productButton.getAttribute("data-build-product-id");
    const product = findProductById(productId);
    const productCard = productButton.closest(".product-card");
    const productIsSelected = selectedProductIds.indexOf(productId) !== -1;

    if (productIsSelected) {
      productButton.textContent = "−";
      productButton.setAttribute("aria-label", "Remove " + product.name);
      productButton.setAttribute("aria-pressed", "true");

      if (productCard !== null) {
        productCard.classList.add("selected-product-card");
      }
    } else {
      productButton.textContent = "+";
      productButton.setAttribute("aria-label", "Add " + product.name);
      productButton.setAttribute("aria-pressed", "false");

      if (productCard !== null) {
        productCard.classList.remove("selected-product-card");
      }
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
  const packNameHeading = document.querySelector("[data-pack-name]");
  const packSummaryName = document.querySelector("[data-pack-summary-name]");
  const packSummaryPrice = document.querySelector("[data-pack-summary-price]");
  const summaryCount = document.querySelector(".summary-head > span");
  const summaryVibe = document.querySelector(".summary-sub");
  const progressBar = document.querySelector(".summary-progress span");
  const checkoutButton = document.querySelector(".checkout-button");

  if (packCounter !== null) {
    packCounter.textContent = selectedCount;
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
    summaryVibe.textContent = getSavedData(storageKeys.selectedVibe, "GAME ON") + " pack";
  }

  if (progressBar !== null) {
    progressBar.style.width = (selectedCount / packSize) * 100 + "%";
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

/*
  Product cards are redrawn after Firebase loads the cloud catalog, so their
  click listeners live in their own function and can be attached again.
*/
function connectBuildProductButtons() {
  const productButtons = document.querySelectorAll(
    ".product-grid .product-info button"
  );

  productButtons.forEach(function (productButton) {
    const productId = productButton.getAttribute("data-build-product-id");
    const product = findProductById(productId);

    if (product !== null) {
      productButton.addEventListener("click", function () {
        const selectedProductIds = getBuildPack();

        const productIndex = selectedProductIds.indexOf(product.id);

        if (productIndex !== -1) {
          selectedProductIds.splice(productIndex, 1);
          saveData(storageKeys.buildPack, selectedProductIds);
          syncCartWithBuildPack();
          updateBuildPackPage();
          showMessage(product.name + " was removed from your pack.");
          return;
        }

        if (selectedProductIds.length >= getPackSize()) {
          showMessage("Your pack is full. Remove an item to add something else.");
          return;
        }

        selectedProductIds.push(product.id);
        saveData(storageKeys.buildPack, selectedProductIds);
        syncCartWithBuildPack();
        updateBuildPackPage();
        showMessage(product.name + " was added to your pack.");
      });
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
  const savedPackSize = getPackSize();
  const savedVibeName = getSavedData(storageKeys.selectedVibe, "GAME ON");

  /* Restore the selected vibe style after the page refreshes. */
  vibeButtons.forEach(function (vibeButton) {
    const vibeName = vibeButton.querySelector("strong").textContent;

    if (vibeName === savedVibeName) {
      vibeButton.classList.add("active");
    } else {
      vibeButton.classList.remove("active");
    }
  });

  sizeCards.forEach(function (sizeCard, cardIndex) {
    const sizeInput = sizeCard.querySelector("input");

    if (packSizes[cardIndex] === savedPackSize) {
      sizeCard.classList.add("selected");
      sizeInput.checked = true;
    } else {
      sizeCard.classList.remove("selected");
    }

    sizeCard.addEventListener("click", function () {
      saveData(storageKeys.packSize, packSizes[cardIndex]);
      syncCartWithBuildPack();

      sizeCards.forEach(function (otherSizeCard) {
        otherSizeCard.classList.remove("selected");
      });

      sizeCard.classList.add("selected");
      sizeInput.checked = true;
      updateBuildPackPage();
    });
  });

  vibeButtons.forEach(function (vibeButton) {
    vibeButton.addEventListener("click", function () {
      const vibeName = vibeButton.querySelector("strong").textContent;
      const starterPack = vibePresets[vibeName];

      if (starterPack === undefined) {
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
      showMessage(vibeName + " starter pack loaded. Add or remove anything you want.");
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
      productsForDisplay = addLocalImagePathsToFirebaseProducts(firebaseProducts);
      renderBuildPackProducts();
      connectBuildProductButtons();
      updateBuildPackPage();
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
  connectBuildProductButtons();
  setupBuilderPage();
  loadFirebaseData();
}

/*
  Firebase can finish connecting before or after the regular page setup.
  Listening for this event covers both cases.
*/
window.addEventListener("variety-backend-ready", loadFirebaseData);

document.addEventListener("DOMContentLoaded", startApplication);
