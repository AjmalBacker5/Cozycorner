// Thin wrapper around Cashfree's REST API — no SDK dependency, so the whole
// integration is readable in one place. Docs:
// https://www.cashfree.com/docs/payments/online/web/redirect
// https://www.cashfree.com/docs/api-reference/vrs/webhook-signature-verification

const crypto = require("crypto");

function baseUrl() {
  return process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function authHeaders() {
  return {
    "x-client-id": process.env.CASHFREE_APP_ID,
    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
    "x-api-version": process.env.CASHFREE_API_VERSION || "2025-01-01",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function createOrder(payload) {
  const res = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Cashfree create order failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchOrder(orderId) {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Cashfree fetch order failed: ${JSON.stringify(data)}`);
  }
  return data;
}

// Cashfree signs webhooks as base64( HMAC-SHA256( timestamp + raw_body, secret_key ) )
// sent as the x-webhook-signature header, with the timestamp in x-webhook-timestamp.
// This MUST run against the raw request body, before any JSON parsing.
function verifyWebhookSignature(signature, timestamp, rawBodyString) {
  if (!signature || !timestamp) return false;
  const signedPayload = timestamp + rawBodyString;
  const expected = crypto
    .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
    .update(signedPayload)
    .digest("base64");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

module.exports = { createOrder, fetchOrder, verifyWebhookSignature };
