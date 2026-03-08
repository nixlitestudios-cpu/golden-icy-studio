// ═══════════════════════════════════════════════════════
//  BEATS.HTML — CART FIX
//  REPLACE the entire "// ── CART ──" block in beats.html
//  with this code. It syncs with cart.html via localStorage.
// ═══════════════════════════════════════════════════════

// ── CART ──
const CART_KEY = 'gis_cart';

function loadCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY))||[]; }catch(e){ return []; } }
function saveCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); }

function toggleCart(){ document.getElementById('cart-sidebar').classList.toggle('open'); document.getElementById('cart-overlay').classList.toggle('open'); }
function closeCart(){  document.getElementById('cart-sidebar').classList.remove('open'); document.getElementById('cart-overlay').classList.remove('open'); }

function addToCart(item){
  const cart = loadCart();
  if(cart.find(c => c.id === item.id)){ toast('⚠️ Already in cart!'); return; }
  cart.push({ ...item, emoji:'🎵', uid: Date.now() + Math.random() });
  saveCart(cart);
  renderCart();
  updateCartCount();
  toast('✓ ' + item.name + ' added to cart!');
  document.getElementById('cart-sidebar').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}

function removeFromCart(uid){
  saveCart(loadCart().filter(c => c.uid != uid));
  renderCart();
  updateCartCount();
}

function updateCartCount(){
  const cart = loadCart();
  const el   = document.getElementById('cart-count');
  el.textContent = cart.length;
  el.classList.toggle('show', cart.length > 0);
}

function cartTotals(){
  const cart = loadCart();
  const sub  = cart.reduce((a,c) => a + Number(c.price), 0);
  const vat  = Math.round(sub * 0.10 * 100) / 100;
  return { sub, vat, total: Math.round((sub + vat) * 100) / 100 };
}

function renderCart(){
  const cart   = loadCart();
  const body   = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');

  if(cart.length === 0){
    body.innerHTML = `<div class="cart-empty" id="cart-empty"><span class="cart-empty-icon">🎵</span>Your cart is empty.<br/>Browse beats and add them!</div>`;
    footer.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-img">🎵</div>
      <div class="cart-item-info">
        <h4>${c.name}</h4>
        <p>${c.type}</p>
        <span class="lic">${c.lic}</span>
        <button class="cart-remove" onclick="removeFromCart(${c.uid})">✕ Remove</button>
      </div>
      <div class="cart-item-price">$${Number(c.price).toFixed(2)}</div>
    </div>`).join('');

  const t = cartTotals();
  document.getElementById('cart-sub').textContent      = '$' + t.sub.toFixed(2);
  document.getElementById('cart-vat').textContent      = '$' + t.vat.toFixed(2);
  document.getElementById('cart-total-el').textContent = '$' + t.total.toFixed(2);
  footer.style.display = '';
}

// Also wire the "View Cart" / "Go to Cart" button in the sidebar to cart.html
// Change the Checkout button to go to cart.html instead of opening the old modal
function openCheckout(){
  window.location.href = 'cart.html';
}

// Sync badge when another tab changes the cart
window.addEventListener('storage', function(e){
  if(e.key === CART_KEY){ renderCart(); updateCartCount(); }
});

// Run on page load
document.addEventListener('DOMContentLoaded', function(){
  renderCart();
  updateCartCount();
});
