// Shared checkout flow for every product page. Each page sets
// window.PRODUCT = { id, name, price } before loading this script.
// Keep CASHFREE_MODE in sync with CASHFREE_ENV on the server (see .env).

document.addEventListener('DOMContentLoaded', function () {
  var PRODUCT = window.PRODUCT;
  if (!PRODUCT) return;

  var CASHFREE_MODE = 'sandbox';
  var cashfree = Cashfree({ mode: CASHFREE_MODE });

  var modal = document.getElementById('buyModal');
  var modalProduct = document.getElementById('modalProduct');
  var modalPrice = document.getElementById('modalPrice');
  var buyForm = document.getElementById('buyForm');
  var buyError = document.getElementById('buyError');
  var payBtn = document.getElementById('payBtn');

  function openModal() {
    modalProduct.textContent = PRODUCT.name;
    modalPrice.textContent = '₹' + PRODUCT.price;
    buyError.textContent = '';
    modal.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-buy]').forEach(function (btn) {
    btn.addEventListener('click', openModal);
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  buyForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    buyError.textContent = '';
    payBtn.disabled = true;
    payBtn.textContent = 'Starting secure checkout…';

    var formData = new FormData(buyForm);
    var body = {
      product: PRODUCT.id,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone')
    };

    try {
      var res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment.');

      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: '_self'
      });
    } catch (err) {
      buyError.textContent = err.message || 'Something went wrong. Please try again.';
      payBtn.disabled = false;
      payBtn.textContent = 'Pay securely';
    }
  });
});
