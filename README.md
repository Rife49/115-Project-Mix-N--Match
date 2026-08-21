# Variety Co. - Project Guide

This is a beginner-friendly snack and drink pack website for learning HTML, CSS, JavaScript, and Firebase.

The website still works as a local demo before Firebase is set up. It now also includes a Firebase backend for cloud products, guest accounts, saved carts, and protected fake-payment orders. The practice checkout never charges money or accepts a real card. The Account page is a browser-only learning sign-in with no password; real password accounts, payments, and shipping labels are still future work.

## Open the project

Open this folder in Visual Studio Code:

`115 Project Mix N' Match`

The main page is `index.html`.

If you use the Live Server extension in VS Code, right-click `index.html` and choose **Open with Live Server**. The project settings use port 5501.

## Pages

| File | What it does |
| --- | --- |
| `index.html` | The home page. It introduces Variety Co. and links to the pack builder. |
| `build-pack.html` | Lets a visitor choose a pack size, choose a vibe, and select products. Choosing a vibe immediately loads its starter items into the cart, where the pack stays editable. |
| `about-us.html` | Explains the Variety Co. idea in a simple way. |
| `cart.html` | Shows saved cart items, product quantities, and the selected box price. |
| `account.html` | A browser-only Sign In page with Previously Bought products and an editable Quick Box for fast reorders. |
| `users.html` | A practice page for switching between pretend customers. It is not linked in the public navigation because it is for learning. |

The Shop All page and the Learn page were removed to keep the website simpler.

## Important JavaScript files

### `mock-data.js`

This file is the browser catalog. It holds 20 real-brand product examples and mock user objects. The products are catalog examples only; you still need supplier approval and current availability before selling real inventory.

A product object looks like this:

```javascript
{
  id: "grape-rush",
  name: "Grape Rush",
  price: 3.49
}
```

You can edit a product name, label, color class, or description here. The official box prices are in packOptions near the vibe presets.

### `app.js`

This file makes the site interactive. It contains small functions for:

- Saving and reading browser data
- Choosing a pack size
- Saving a vibe
- Adding products to a custom pack
- Keeping the editable pack and cart synchronized
- Showing cart items and totals
- Switching the active mock user
- Updating the bag number in the navigation
- Loading the cloud catalog and saved cart after Firebase connects

## How the cart works

1. On **Build Your Pack**, choose a vibe to load six starter products into the cart immediately.
2. Use the plus and minus buttons to edit the pack and cart together.
3. When the selected pack is full, the main button changes to **VIEW YOUR CART**.
4. The cart groups matching products together, shows their quantity, and shows the selected box price.
5. You can remove one item at a time or clear the whole cart.
6. When every pack spot is full, choose **CHECK OUT WITH TEST CARD**. The practice checkout accepts only its displayed test values and creates a fake paid order.

The cart is a learning demo. It does not collect real payment information, calculate real tax, or create a real shippable order.

## Local storage

Local storage is a small storage area inside the browser. It makes the website work before Firebase has been connected and gives each page a quick local copy of the active pack. Once Firebase is connected, the cart is also saved online under the visitor's Firebase guest account.

| Storage key | What is saved |
| --- | --- |
| `varietyCart` | The product IDs currently in the cart. |
| `varietyActiveUser` | The ID of the selected mock user. |
| `varietyBuildPack` | The product IDs selected for the current pack. |
| `varietyPackSize` | The selected pack size: 6, 12, or 18. |
| `varietySelectedVibe` | The selected vibe, such as Game On or Movie Night. |
| `varietyFakeOrders` | Fake checkout receipts when Firebase is not connected. |
| `varietyAccount` | The name and email for the learning sign-in on this browser. |
| `varietyPreviouslyBoughtProducts-...` | Product IDs saved after a signed-in test checkout. The ending comes from the saved email. |
| `varietyQuickBox-...` | The editable ready-to-go box for the saved email. |

To start fresh, use the **CLEAR CART** button on the Cart page. You can also clear site data through your browser settings.

## Learning sign-in and quick reorder

The **Sign In** navigation link opens `account.html`. This page is intentionally simple so you can study how browser storage works:

1. Enter a name and email. The browser saves them locally; no password is requested or stored.
2. Complete a practice checkout while signed in. The products go into that email’s **Previously Bought** list.
3. Select **ADD** to put a product into the editable **Quick Box**. Select **DELETE** to remove it from either list.
4. Once the Quick Box has the right number of products for the selected pack size, **GO TO QUICK CHECKOUT** sends it to the Cart page.

This is not a secure customer login and will not follow someone to another browser or device. When you are ready for real accounts, enable Email/Password in Firebase Authentication and replace these local sign-in helpers in `app.js` with Firebase Authentication calls.

## Responsive page sizes

The website uses CSS media queries, which are small rules that change the layout when the screen becomes narrower.

- **Tablet:** Around 900 to 1100 pixels wide, large columns stack so the text and cards still have room.
- **Phone:** Around 700 to 720 pixels wide, the navigation becomes a scrollable second row, grids become one or two columns, and tap buttons get larger.
- **Small iPhone:** At 430 pixels wide or less, headings, image areas, and page spacing become smaller again.

The responsive rules are at the bottom of `css/style.css`, `css/build-pack.css`, `css/about-us.css`, and `css/app.css`.

## CSS files

| File | What it styles |
| --- | --- |
| `css/style.css` | The home page. |
| `css/build-pack.css` | The shared navigation and the Build Your Pack page. |
| `css/about-us.css` | The About Us page. |
| `css/app.css` | The Cart page, Account page, Mock Users page, and small JavaScript messages. |

## Important HTML ideas

- **HTML** gives the page its structure and text.
- **CSS** controls colors, spacing, layout, and fonts.
- **JavaScript** reacts to clicks and changes the page.
- **Mock data** is pretend information used before a real database exists.
- **Local storage** is browser storage for small saved values.
- A **data attribute** is an HTML label JavaScript can find. For example, `data-cart-count` tells JavaScript where to show the number of cart items.

## Images

The `images` folder contains the website images used on the Home and About pages. Its `images/products` folder now holds one front-facing package photo for each of the 20 Build Your Pack products.

Each product object has an `imagePath` value, such as `images/products/red-bull-original.jpg`. The page uses that value to show the real package photo; the old CSS artwork remains only as a backup if a photo path is missing.

These brand package photos are for this learning preview only. They are not automatically licensed for public or commercial use. Before launching Variety Co. publicly or selling a product, get written permission or a licensed product-image feed from each brand or distributor.

## Good next things to learn

- Add a **Reset Pack** button to Build Your Pack.
- Make category and filter buttons work.
- Finish replacing the local mock data with Firestore everywhere.
- Replace the browser-only learning sign-in with secure Firebase Email/Password accounts.
- Connect a real checkout and payment provider.

For now, the goal is to understand the HTML, CSS, JavaScript, catalog data, local storage, and Firebase before adding those bigger features.

## Previous page addresses

The old `shop-all.html` and `learn.html` addresses are kept only as tiny redirects. They are not visible pages and are not linked in the navigation.

- `shop-all.html` sends an old browser tab to `build-pack.html`.
- `learn.html` sends an old browser tab to `index.html`.

These redirect files prevent a missing-page error when Live Server refreshes a tab that was already open before those pages were removed.

## Vibe starter packs

Step 2 on Build Your Pack has five six-item starter packs:

- Game On
- Movie Night
- Game Day
- All-Nighter
- Chill Mode

The lists live in `vibePresets` inside `mock-data.js`. When a visitor clicks a vibe, its starter list replaces the editable **Your Box** selection.

Selected cards have a red outline and a minus button. Click the minus button to remove an item. Click a plus button on another card to add it. The starter products are added to the Bag cart as soon as the vibe is clicked. The plus and minus buttons keep the editable pack and Bag cart synchronized. When the pack is full, **VIEW YOUR CART** opens the cart page.

## Pack prices

The official box prices are stored in `packOptions` inside `mock-data.js`.

| Box | Price |
| --- | --- |
| The Six | $24.00 |
| The Dozen | $44.00 |
| The Party Pack | $59.00 |

The Builder summary and Cart read from this same object. Individual product prices are reference examples only; they do not change the box price in the cart.


## Fake payment checkout

The Cart page has a practice payment window. It starts with these required test values:

| Field | Test value |
| --- | --- |
| Card number | `4242 4242 4242 4242` |
| Expiry | `12/34` |
| CVC | `123` |

The form rejects every other value. It never saves the text entered into the fields. In local mode, it saves a small fake receipt under `varietyFakeOrders`. With Firebase connected, it sends only the fixed value `variety-test-card-4242` to a protected Cloud Function; that function saves a fake paid order with the test card ending in 4242.

Do not enter a real card number. This is not a payment provider and cannot charge money.

## Firebase backend

The Firebase backend files are ready, but they need your own Firebase project details before they can go online. Follow [firebase-setup.md](firebase-setup.md) one step at a time.

| File or folder | What it does |
| --- | --- |
| `firebase-config.js` | The one file where you paste the web app configuration from Firebase. |
| `.firebaserc` | Holds the Firebase project ID used when you deploy. |
| `firebase.json` | Tells Firebase about the website, Cloud Functions, Firestore rules, and local emulators. |
| `firebase-client.js` | Connects the browser pages to Authentication, Firestore, and Cloud Functions. |
| `firestore.rules` | The security rules that protect carts, profiles, products, and orders. |
| `functions/index.js` | The protected server actions: catalog setup and fake-payment checkout. |
| `functions/catalog.js` | The protected server copy of the 20 real-brand product examples, box prices, and vibe presets. |

### What Firebase saves

- **Products, box prices, and vibe presets:** Firestore creates these from the server catalog the first time Variety connects.
- **Guest user profile:** Anonymous Authentication gives every visitor a real Firebase user ID.
- **Learning account page:** `account.html` separately saves a name, email, purchase history, and Quick Box in this browser. It does not use a password or replace Firebase Authentication.
- **Cart:** The selected products, box size, and vibe live in that visitor's private Firestore cart document.
- **Fake-payment order:** The Cloud Function verifies the selected box and product IDs, then records a test-only payment status. It receives no card number, expiry date, or CVC.

The browser cannot directly edit products, box prices, or orders. Those writes are locked by Firestore rules or happen inside Cloud Functions. Do not replace the rules with an `allow read, write: if true` rule.

### Why there are two catalogs for now

`mock-data.js` keeps the product cards easy to learn from in the browser. `functions/catalog.js` is the protected server copy used to seed Firestore and verify orders. When you edit a product, its `imagePath`, a pack price, or a vibe preset, make the same update in both files. If the Firebase catalog is already online, increase `catalogVersion` in `functions/index.js` by one so the next catalog initialization updates Firestore. Keeping this duplication visible is simpler while you are learning; later we can remove `mock-data.js` and read every product directly from Firestore.
