/* Marsel's Special Sauce — storefront interactions (shared by every page)
 *
 * CHECKOUT: set CHECKOUT_URL to your Shopify / Stripe Payment Link / Square checkout.
 * The cart is kept in localStorage so it survives page reloads and follows shoppers between pages.
 * SIGNUP_URL: set to your email platform's form endpoint (Klaviyo, Mailchimp, etc.).
 * Page-specific features only run when their elements exist on the page.
 */
const CHECKOUT_URL = "";
const SIGNUP_URL = "";
const CONTACT_URL = ""; // contact form endpoint (Formspree, Netlify Forms, Basin, etc.)
const FREE_SHIP = 35;
const SUB_DISCOUNT = 0.15;

// Prices are placeholders — keep in sync with the HTML product cards and JSON-LD.
// icon = which SVG symbol to show in the cart (#bottle, #gift, #tee, #hat).
const PRODUCTS = {
  single: { name: "The Original", detail: "1 bottle · 5 oz", price: 12, icon: "bottle" },
  triple: { name: "The Triple Threat", detail: "3 bottles", price: 32, icon: "bottle" },
  party:  { name: "The Party Pack", detail: "6 bottles", price: 59, icon: "bottle" },
  gift:   { name: "The Gift Box", detail: "2 bottles + recipe cards", price: 29, icon: "gift" },
  tee:    { name: "Sauce Boss Tee", detail: "100% cotton", price: 28, icon: "tee" },
  hat:    { name: "Marsel's Dad Hat", detail: "One size", price: 26, icon: "hat" },
};

// Stockists shown on the Find a Store page. type: "shop" | "restaurant" | "bar".
// The three "sample" entries are placeholders so you can see the layout — delete them
// and add your real stores before launch (an empty list shows a friendly empty state).
const STORES = [
  { name: "Sample Market", type: "shop", address: "123 Example St", city: "Your City", state: "ST", zip: "00000", note: "Carries the Original & Gift Box", sample: true },
  { name: "Sample Taco Spot", type: "restaurant", address: "456 Placeholder Ave", city: "Your City", state: "ST", zip: "00000", note: "A bottle on every table", sample: true },
  { name: "Sample Bar & Grill", type: "bar", address: "789 Demo Blvd", city: "Another Town", state: "ST", zip: "00001", note: "Ask for the Marsel's Bloody Mary", sample: true },
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => `$${n.toFixed(2)}`;
const subPrice = (n) => Math.round(n * (1 - SUB_DISCOUNT) * 100) / 100;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Cart state ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem("mss-cart")) || []; } catch { cart = []; }
cart = cart.filter((i) => PRODUCTS[i.id]);
const save = () => { try { localStorage.setItem("mss-cart", JSON.stringify(cart)); } catch {} };

const unitPrice = (item) => {
  const base = PRODUCTS[item.id].price;
  return item.sub ? subPrice(base) : base;
};

function addToCart(id, sub, variant = "") {
  const found = cart.find((i) => i.id === id && i.sub === sub && (i.variant || "") === variant);
  if (found) found.qty++;
  else cart.push({ id, sub, variant, qty: 1 });
  save();
  renderCart();
  const badge = $("[data-cart-count]");
  badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump");
  track("add_to_cart", { item_id: id, subscription: sub, variant });
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  save();
  renderCart();
}

function renderCart() {
  const list = $("[data-cart-items]");
  const count = cart.reduce((n, i) => n + i.qty, 0);
  const total = cart.reduce((n, i) => n + unitPrice(i) * i.qty, 0);

  $("[data-cart-count]").textContent = count;
  $("[data-cart-total]").textContent = money(total);
  $("[data-cart-empty]").hidden = cart.length > 0;
  $(".cart-foot").hidden = cart.length === 0;

  const left = FREE_SHIP - total;
  $("[data-ship-msg]").textContent = left > 0
    ? `You're ${money(left)} away from free shipping!`
    : "🎉 You unlocked free shipping!";
  $("[data-ship-bar]").style.width = `${Math.min(100, (total / FREE_SHIP) * 100)}%`;
  renderShipCheck(total);

  list.innerHTML = cart.map((item, i) => {
    const p = PRODUCTS[item.id];
    const extras = [item.variant && `Size ${item.variant}`, item.sub && "Subscribe & save 15%"].filter(Boolean);
    return `<li class="cart-item">
      <svg viewBox="0 0 200 420" aria-hidden="true"><use href="#${p.icon}"/></svg>
      <div>
        <h3>${p.name}</h3>
        <small>${[p.detail, ...extras].join(" · ")}</small>
        <div class="qty">
          <button type="button" data-qty="${i}" data-delta="-1" aria-label="Decrease quantity">−</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="${i}" data-delta="1" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <span class="line-price">${money(unitPrice(item) * item.qty)}</span>
    </li>`;
  }).join("");
}

// Live free-shipping check (shipping page)
function renderShipCheck(total) {
  const box = $("[data-ship-check]");
  if (!box) return;
  const left = FREE_SHIP - total;
  const title = $("[data-ship-check-title]");
  const msg = $("[data-ship-check-msg]");
  const cta = $("[data-ship-check-cta]");
  if (total === 0) {
    title.textContent = "Your cart is empty";
    msg.textContent = `Add ${money(FREE_SHIP)} of sauce and shipping is on us.`;
    cta.textContent = "Shop the sauce";
  } else if (left > 0) {
    title.textContent = `Your cart: ${money(total)}`;
    msg.textContent = `You're ${money(left)} away from free shipping. A Triple Threat would do it!`;
    cta.textContent = "Top up your cart";
  } else {
    title.textContent = `Your cart: ${money(total)} 🎉`;
    msg.textContent = "You've unlocked free shipping. Nice work.";
    cta.textContent = "Keep shopping";
  }
  box.classList.toggle("unlocked", total > 0 && left <= 0);
  $("[data-ship-check-bar]").style.width = `${Math.min(100, (total / FREE_SHIP) * 100)}%`;
}

/* ---------- Cart drawer ---------- */
const drawer = $("[data-cart]");
const scrim = $("[data-cart-scrim]");
const openBtn = $("[data-open-cart]");

function openCart() {
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  openBtn.setAttribute("aria-expanded", "true");
  scrim.hidden = false;
  $(".cart-close").focus();
}
function closeCart() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  openBtn.setAttribute("aria-expanded", "false");
  scrim.hidden = true;
}

openBtn.addEventListener("click", openCart);
scrim.addEventListener("click", closeCart);
$$("[data-close-cart]").forEach((b) => b.addEventListener("click", closeCart));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

drawer.addEventListener("click", (e) => {
  const b = e.target.closest("[data-qty]");
  if (b) changeQty(+b.dataset.qty, +b.dataset.delta);
});

$$("[data-add]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const id = btn.dataset.add;
    const card = btn.closest("[data-product]");
    const checked = card && $("input:checked", card);
    const sub = checked ? checked.value === "sub" : false;
    const variantEl = card && $("[data-variant]", card);
    addToCart(id, sub, variantEl ? variantEl.value : "");
    pepperBurst(e.clientX, e.clientY);
    toast(`🌶️ ${PRODUCTS[id].name} added to your stash!`);
    setTimeout(openCart, reduceMotion ? 0 : 450);
  });
});

// Price display on each card; cards with a subscribe option also show the 15%-off price
$$("[data-product]").forEach((card) => {
  const base = PRODUCTS[card.dataset.product].price;
  const priceEl = $("[data-price]", card);
  if (priceEl) priceEl.textContent = money(base);
  const subInput = $("input[value=sub]", card);
  if (!subInput) return;
  const subTag = document.createElement("b");
  subTag.textContent = money(subPrice(base));
  subInput.parentElement.append(subTag);
  const sync = () => {
    priceEl.style.opacity = subInput.checked ? ".45" : "1";
    priceEl.style.textDecoration = subInput.checked ? "line-through" : "none";
  };
  $$("input[type=radio]", card).forEach((r) => r.addEventListener("change", sync));
  sync();
});

$("[data-checkout]").addEventListener("click", () => {
  track("begin_checkout", { value: cart.reduce((n, i) => n + unitPrice(i) * i.qty, 0) });
  if (CHECKOUT_URL) {
    window.location.href = CHECKOUT_URL;
  } else {
    toast("Checkout isn't connected yet — add your Shopify or Stripe link in main.js");
  }
});

/* ---------- Site menu (mobile) ---------- */
const menu = $("[data-menu]");
const menuBtn = $("[data-menu-btn]");
function setMenu(open) {
  menu.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

/* ---------- Pages not built yet ----------
 * Links with data-soon point at their future URL. Until that page exists, a click
 * shows a friendly note instead of a 404. Remove data-soon once the page is live.
 */
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-soon]");
  if (!link) return;
  e.preventDefault();
  setMenu(false);
  const name = (link.querySelector("strong") || link).textContent.replace("→", "").trim();
  toast(`🌶️ "${name}" is still simmering. Coming soon!`);
});

/* ---------- Fun bits ---------- */
function pepperBurst(x, y) {
  if (reduceMotion) return;
  const emojis = ["🌶️", "🔥", "🌶️", "✨"];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = emojis[i % emojis.length];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist - 60}px`);
    el.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
  }
}

let toastTimer;
function toast(msg) {
  const t = $("[data-toast]");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// Rotating word in the hero headline (home page)
const swap = $("[data-swap]");
if (swap && !reduceMotion) {
  const words = ["everything", "tacos", "eggs", "wings", "pizza", "Tuesday", "leftovers", "everything"];
  let w = 0;
  setInterval(() => {
    swap.classList.add("out");
    setTimeout(() => {
      w = (w + 1) % words.length;
      swap.textContent = words[w];
      swap.classList.remove("out");
    }, 250);
  }, 2200);
}

// Click the bottle to shake it (home page)
const bottle = $(".hero-bottle");
if (bottle) {
  bottle.addEventListener("click", (e) => {
    bottle.classList.remove("shake"); void bottle.offsetWidth; bottle.classList.add("shake");
    pepperBurst(e.clientX, e.clientY);
  });
  bottle.addEventListener("animationend", (e) => { if (e.animationName === "shake") bottle.classList.remove("shake"); });
}

/* ---------- Bravery slider (home page) ---------- */
const brave = $("[data-brave]");
if (brave) {
  const BRAVE = [
    { title: "Cautious Taster", text: "Start with a single drop on your eggs. You'll be back for more.", n: 1 },
    { title: "Curious Dabber", text: "A couple of dashes on tacos. Pure flavor, gentle warmth.", n: 2 },
    { title: "Everyday Saucer", text: "Three to four dashes on whatever's on your plate. The sweet spot.", n: 3 },
    { title: "Bold Pourer", text: "Toss your wings in it. Mix it into your mayo. You get it.", n: 4 },
    { title: "Certified Sauce Boss", text: "Straight from the bottle. We respect you. Grab the Party Pack.", n: 5 },
  ];
  const renderBrave = () => {
    const b = BRAVE[brave.value - 1];
    $("[data-brave-peppers]").textContent = "🌶️".repeat(b.n);
    $("[data-brave-title]").textContent = b.title;
    $("[data-brave-text]").textContent = b.text;
  };
  brave.addEventListener("input", renderBrave);
  renderBrave();
}

/* ---------- Sauce Matchmaker (home page) ---------- */
const chips = $("[data-chips]");
if (chips) {
  const MATCHES = {
    eggs:   { e: "🍳", t: "Scrambled, fried, or deviled", x: "Three dashes right on top while they're still hot. The garlic and lime cut through the richness of the yolk like they were made for each other.", d: "3 dashes" },
    tacos:  { e: "🌮", t: "Street tacos & burritos", x: "Drizzle over carne asada, fish or roasted veggie tacos. The citrus brightens everything, so you might skip the lime wedge.", d: "A generous drizzle" },
    wings:  { e: "🍗", t: "Game-day wings", x: "Whisk ¼ cup of sauce with 3 tbsp melted butter and toss with crispy wings. Instant buffalo-style with way more flavor.", d: "¼ cup per 2 lbs" },
    pizza:  { e: "🍕", t: "Pizza night", x: "Swirl it over a hot slice or mix with honey for a sweet-heat drizzle on pepperoni. Better than chili flakes, every time.", d: "A zig-zag per slice" },
    mac:    { e: "🧀", t: "Mac & cheese", x: "Stir a tablespoon into the cheese sauce, then dot more on top before serving. Creamy, cheesy, with a kick.", d: "1 tbsp + extra on top" },
    drinks: { e: "🍹", t: "Bloody Marys & micheladas", x: "Add 4–6 dashes to your Bloody Mary or michelada mix. It's the secret ingredient bartenders ask about.", d: "4–6 dashes" },
  };
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-food]");
    if (!b) return;
    $$("[data-food]", chips).forEach((c) => c.setAttribute("aria-selected", c === b ? "true" : "false"));
    const m = MATCHES[b.dataset.food];
    const emoji = $("[data-match-emoji]");
    emoji.textContent = m.e;
    emoji.style.animation = "none"; void emoji.offsetWidth; emoji.style.animation = "";
    $("[data-match-title]").textContent = m.t;
    $("[data-match-text]").textContent = m.x;
    $("[data-match-dose]").textContent = m.d;
  });
}

/* ---------- Shop filters & sort (shop page) ---------- */
const grid = $("[data-shop-grid]");
if (grid) {
  const cards = $$("[data-product]", grid);
  const original = [...cards];
  const countEl = $("[data-shop-count]");
  const sortEl = $("[data-sort]");
  let filter = "all";

  const applyShop = () => {
    const sorted = [...original];
    if (sortEl.value === "low") sorted.sort((a, b) => PRODUCTS[a.dataset.product].price - PRODUCTS[b.dataset.product].price);
    if (sortEl.value === "high") sorted.sort((a, b) => PRODUCTS[b.dataset.product].price - PRODUCTS[a.dataset.product].price);
    let shown = 0;
    sorted.forEach((card) => {
      const match = filter === "all" || card.dataset.category.split(" ").includes(filter);
      card.hidden = !match;
      if (match) shown++;
      grid.append(card);
    });
    countEl.textContent = `${shown} ${shown === 1 ? "item" : "items"}`;
  };

  $("[data-filters]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = b.dataset.filter;
    $$("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    applyShop();
  });
  sortEl.addEventListener("change", applyShop);

  // Deep links like shop.html#gifts or #merch open with that filter applied
  const hashFilter = location.hash.slice(1);
  const preset = hashFilter && $(`[data-filter="${hashFilter}"]`);
  if (preset) preset.click();
  else applyShop();
}

/* ---------- Recipe filters (recipes page) ---------- */
const recipeFilters = $("[data-recipe-filters]");
if (recipeFilters) {
  const recipeCards = $$("[data-recipe-grid] .recipe-card");
  recipeFilters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rfilter]");
    if (!b) return;
    const f = b.dataset.rfilter;
    $$("[data-rfilter]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    let shown = 0;
    recipeCards.forEach((card) => {
      const match = f === "all" || card.dataset.category.split(" ").includes(f);
      card.hidden = !match;
      if (match) shown++;
    });
    $("[data-recipe-empty]").hidden = shown > 0;
  });
  // Deep links like recipes.html#michelada open that recipe
  const target = location.hash && $(`.recipe-card#${CSS.escape(location.hash.slice(1))} details`);
  if (target) target.open = true;
}

/* ---------- Store locator (find-a-store page) ---------- */
const storeList = $("[data-store-list]");
if (storeList) {
  const TYPE = {
    shop: { emoji: "🛒", label: "Shop" },
    restaurant: { emoji: "🍽️", label: "Restaurant" },
    bar: { emoji: "🍺", label: "Bar" },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const searchForm = $("[data-store-search]");
  let typeFilter = "all";

  // Deterministic pin position per store so the decorative map doesn't jump around
  const pinSpot = (name) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { x: 12 + (h % 76), y: 14 + ((h >>> 8) % 66) };
  };

  const renderStores = () => {
    const q = searchForm.q.value.trim().toLowerCase();
    const matches = STORES.filter((s) => {
      const typeOk = typeFilter === "all" || s.type === typeFilter;
      const text = `${s.name} ${s.city} ${s.state} ${s.zip}`.toLowerCase();
      return typeOk && (!q || text.includes(q));
    });

    storeList.innerHTML = matches.map((s) => {
      const t = TYPE[s.type];
      const where = `${s.address}, ${s.city}, ${s.state} ${s.zip}`;
      const directions = s.sample
        ? ""
        : `<a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${where}`)}" target="_blank" rel="noopener">Directions</a>`;
      return `<li class="store-card">
        <span class="store-emoji" aria-hidden="true">${t.emoji}</span>
        <div class="store-info">
          <h3>${esc(s.name)}${s.sample ? ' <span class="sample-tag">Sample</span>' : ""}</h3>
          <p>${esc(s.address)}<br>${esc(s.city)}, ${esc(s.state)} ${esc(s.zip)}</p>
          <p class="store-note">${t.label} · ${esc(s.note)}</p>
        </div>
        ${directions}
      </li>`;
    }).join("");

    $("[data-store-count]").textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? "spot" : "spots"} pouring Marsel's${q ? ` near “${searchForm.q.value.trim()}”` : ""}`
      : "";
    $("[data-store-empty]").hidden = matches.length > 0;
    $("[data-store-empty-title]").textContent = q ? `No sauce spotted near “${searchForm.q.value.trim()}”… yet.` : "No sauce spotted here… yet.";

    $("[data-map-pins]").innerHTML = matches.map((s, i) => {
      const { x, y } = pinSpot(s.name);
      return `<span class="map-pin" style="left:${x}%;top:${y}%;animation-delay:${i * 0.12}s"><i>${TYPE[s.type].emoji}</i></span>`;
    }).join("");
  };

  searchForm.addEventListener("submit", (e) => { e.preventDefault(); renderStores(); });
  searchForm.q.addEventListener("input", renderStores);
  $("[data-store-filters]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sfilter]");
    if (!b) return;
    typeFilter = b.dataset.sfilter;
    $$("[data-sfilter]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderStores();
  });
  renderStores();
}

/* ---------- Contact & wholesale forms ----------
 * Every [required] field is checked; its data-msg is shown when it's empty or invalid.
 */
const contact = $("[data-contact]");
if (contact) {
  const success = $("[data-contact-success]");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // form.name is the form's own name attribute, so look fields up through .elements
  const field = (n) => contact.elements.namedItem(n);

  // Show the extra field that matches the chosen topic
  const syncTopic = () => {
    const topic = field("topic").value;
    $$("[data-show-for]", contact).forEach((f) => { f.hidden = f.dataset.showFor !== topic; });
  };
  $$("input[name=topic]", contact).forEach((r) => r.addEventListener("change", syncTopic));
  syncTopic();

  const setError = (name, msg) => {
    const out = $(`[data-error-for="${name}"]`, contact);
    if (out) out.textContent = msg;
    field(name).setAttribute("aria-invalid", msg ? "true" : "false");
  };

  contact.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errors = {};
    $$("[required]", contact).forEach((el) => {
      const v = el.value.trim();
      const ok = el.type === "email" ? EMAIL_RE.test(v) : el.tagName === "TEXTAREA" ? v.length >= 5 : v !== "";
      errors[el.name] = ok ? "" : el.dataset.msg || "Please fill this in.";
    });
    Object.entries(errors).forEach(([k, v]) => setError(k, v));
    const firstBad = Object.keys(errors).find((k) => errors[k]);
    if (firstBad) { field(firstBad).focus(); return; }

    if (CONTACT_URL) {
      try {
        const res = await fetch(CONTACT_URL, { method: "POST", body: new FormData(contact), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(res.status);
      } catch {
        toast("Hmm, that didn't send. Please try again or email us directly.");
        return;
      }
    }
    track("generate_lead", { topic: field("topic").value });
    contact.hidden = true;
    success.hidden = false;
    success.focus();
    pepperBurst(innerWidth / 2, innerHeight / 2);
  });

  $("[data-contact-again]").addEventListener("click", () => {
    contact.reset();
    syncTopic();
    success.hidden = true;
    contact.hidden = false;
    field("name").focus();
  });
}

/* ---------- Email signup ---------- */
const signup = $("[data-signup]");
if (signup) {
  signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $("[data-signup-msg]");
    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Hmm, that email looks a little undercooked. Try again?";
      return;
    }
    if (SIGNUP_URL) {
      try {
        await fetch(SIGNUP_URL, { method: "POST", body: new FormData(form) });
      } catch {
        msg.textContent = "Something went wrong. Please try again.";
        return;
      }
    }
    track("sign_up", { method: "newsletter" });
    msg.textContent = "🔥 You're in! Check your inbox for your 10% off code.";
    form.reset();
  });
}

/* ---------- Scroll effects ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("in");
    // Drop the reveal classes once done so hover transforms on cards/tiles work again
    setTimeout(() => en.target.classList.remove("reveal", "in"), 800);
    if (en.target.matches("[data-meter]")) en.target.style.setProperty("--fill", "60%");
    io.unobserve(en.target);
  });
}, { threshold: 0.2 });

$$(".product, .recipe, .review, .brave-card, .match, .story-badge, .tile, .step").forEach((el) => {
  el.classList.add("reveal");
  io.observe(el);
});
const meter = $("[data-meter]");
if (meter) io.observe(meter);

// Sticky mobile buy bar (home page): show after the hero scrolls away, hide near the shop
const mobileBar = $("[data-mobile-buy]");
if (mobileBar) {
  let heroGone = false, shopVisible = false;
  const syncBar = () => mobileBar.classList.toggle("show", heroGone && !shopVisible);
  new IntersectionObserver(([en]) => { heroGone = !en.isIntersecting; syncBar(); }).observe($(".hero"));
  new IntersectionObserver(([en]) => { shopVisible = en.isIntersecting; syncBar(); }).observe($("#shop"));
}

$("[data-year]").textContent = new Date().getFullYear();

/* ---------- Analytics hook ----------
 * Sends events to Google Analytics 4 / Meta Pixel if you add their snippets to <head>.
 */
function track(event, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", event, params);
  if (typeof window.fbq === "function" && event === "add_to_cart") window.fbq("track", "AddToCart");
}

renderCart();
