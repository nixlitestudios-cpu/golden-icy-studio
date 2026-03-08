/**
 * ═══════════════════════════════════════════════════════
 *  GOLDEN ICY STUDIO — CART CONNECTOR
 *  Drop this script into EVERY page (beats, samples, pricing, etc.)
 *  It syncs with cart.html via localStorage.
 *
 *  USAGE on any page:
 *    <!-- Add near closing </body> tag -->
 *    <script src="cart-connector.js"></script>
 *
 *  Then use this anywhere to add an item:
 *    GIS.addToCart({ id:'b1', name:'Beat Name', price:8, type:'Beat', lic:'Basic License', emoji:'🎵' })
 *
 *  The cart badge in your nav will update automatically.
 * ═══════════════════════════════════════════════════════
 */

(function(){
  'use strict';

  const CART_KEY = 'gis_cart';

  // ── LOAD / SAVE CART FROM LOCALSTORAGE ──
  function loadCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch(e) { return []; }
  }
  function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

  // ── GLOBAL API ──
  window.GIS = {

    /**
     * Add an item to the shared cart.
     * @param {Object} item - { id, name, price, type, lic, emoji }
     * @returns {boolean} true if added, false if already in cart
     */
    addToCart: function(item){
      const cart = loadCart();
      if(cart.find(c => c.id === item.id)){
        GIS.toast('⚠️ Already in cart!', true);
        return false;
      }
      cart.push({
        id:    item.id    || ('item-' + Date.now()),
        name:  item.name  || 'Untitled',
        price: Number(item.price) || 0,
        type:  item.type  || 'Beat',
        lic:   item.lic   || 'Basic License',
        emoji: item.emoji || '🎵',
        uid:   Date.now() + Math.random(),
      });
      saveCart(cart);
      GIS._updateBadge();
      GIS.toast('✓ ' + item.name + ' added to cart!');
      return true;
    },

    /**
     * Remove an item by id.
     */
    removeFromCart: function(id){
      const cart = loadCart().filter(c => c.id !== id);
      saveCart(cart);
      GIS._updateBadge();
    },

    /**
     * Get count of items in cart.
     */
    getCount: function(){
      return loadCart().length;
    },

    /**
     * Get full cart array.
     */
    getCart: function(){
      return loadCart();
    },

    /**
     * Check if an item is already in cart.
     */
    inCart: function(id){
      return !!loadCart().find(c => c.id === id);
    },

    /**
     * Clear cart completely.
     */
    clearCart: function(){
      localStorage.removeItem(CART_KEY);
      GIS._updateBadge();
    },

    /**
     * Navigate to the cart page.
     */
    goToCart: function(){
      window.location.href = 'cart.html';
    },

    /**
     * Show a toast notification.
     * Looks for existing #gis-toast or creates one.
     */
    toast: function(msg, isError){
      let t = document.getElementById('gis-toast');
      if(!t){
        t = document.createElement('div');
        t.id = 'gis-toast';
        t.style.cssText = [
          'position:fixed','bottom:2rem','right:2rem',
          'padding:.9rem 1.6rem','font-family:Exo 2,sans-serif',
          'font-size:.72rem','font-weight:500','letter-spacing:.15em',
          'text-transform:uppercase','z-index:9999',
          'transform:translateY(100px)','opacity:0',
          'transition:all .4s','pointer-events:none',
          'border-left:3px solid rgba(255,255,255,.3)',
          'box-shadow:0 10px 40px rgba(0,0,0,.5)',
        ].join(';');
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.background = isError
        ? 'linear-gradient(135deg,#8b0000,#cc2222)'
        : 'linear-gradient(135deg,#7a5c1e,#c9a84c)';
      t.style.color = isError ? '#fff' : '#000';
      t.style.transform = 'translateY(0)';
      t.style.opacity   = '1';
      clearTimeout(GIS._toastTimer);
      GIS._toastTimer = setTimeout(()=>{
        t.style.transform = 'translateY(100px)';
        t.style.opacity   = '0';
      }, 3200);
    },
    _toastTimer: null,

    /**
     * Update all cart badge elements on the page.
     * Looks for elements with class .gis-cart-count or id cart-count.
     */
    _updateBadge: function(){
      const count = loadCart().length;
      // existing beats.html badge
      const el = document.getElementById('cart-count');
      if(el){
        el.textContent = count;
        el.classList.toggle('show', count > 0);
      }
      // generic badge class
      document.querySelectorAll('.gis-cart-count').forEach(badge=>{
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      });
      // update page title badge
      const base = document.title.replace(/^\(\d+\)\s*/,'');
      document.title = count > 0 ? '(' + count + ') ' + base : base;
    },
  };

  // ── AUTO-INIT: update badge on page load ──
  document.addEventListener('DOMContentLoaded', function(){
    GIS._updateBadge();
  });
  // Also run immediately in case DOM already loaded
  if(document.readyState !== 'loading') GIS._updateBadge();

  // ── LISTEN FOR STORAGE CHANGES (cross-tab sync) ──
  window.addEventListener('storage', function(e){
    if(e.key === CART_KEY) GIS._updateBadge();
  });

  // ── WIRE UP any button with data-gis-add attribute ──
  // <button data-gis-add='{"id":"b1","name":"Beat","price":8}'>Add to Cart</button>
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-gis-add]');
    if(!btn) return;
    try {
      const item = JSON.parse(btn.getAttribute('data-gis-add'));
      GIS.addToCart(item);
    } catch(err){ console.warn('GIS: invalid data-gis-add JSON', err); }
  });

})();

/* ─────────────────────────────────────────────
   HOW TO WIRE UP YOUR EXISTING PAGES:
   ─────────────────────────────────────────────

   1. In your <head> or before </body> on EVERY page:
      <script src="cart-connector.js"></script>

   2. Your existing addToCart calls in beats.html just need
      to call GIS.addToCart() instead of the inline function.
      Example — change:
        onclick="addToCart({id:'b1',name:'...',price:8,...})"
      to:
        onclick="GIS.addToCart({id:'b1',name:'...',price:8,emoji:'🎵'})"

   3. For your cart button in the nav, link it to cart.html:
      <button onclick="GIS.goToCart()">🛒</button>

   4. To show a live badge count anywhere on a page:
      <span class="gis-cart-count" style="display:none">0</span>

   5. The cart.html page reads and writes the same localStorage
      key, so everything stays in sync automatically.

   ─────────────────────────────────────────────
   EXAMPLE — adding a beat from beats.html:
   ─────────────────────────────────────────────

   GIS.addToCart({
     id:    'b1',
     name:  '[FREE] Melodic Drill Type Beat',
     price: 8,
     type:  'Beat',
     lic:   'Basic License',
     emoji: '🎵'
   });

   ─────────────────────────────────────────────
   EXAMPLE — adding a sample pack from samples.html:
   ─────────────────────────────────────────────

   GIS.addToCart({
     id:    'sp-trap-01',
     name:  'Trap Drums Vol. 1',
     price: 15,
     type:  'Sample Pack',
     lic:   'Royalty Free',
     emoji: '🥁'
   });

   ─────────────────────────────────────────────
*/
