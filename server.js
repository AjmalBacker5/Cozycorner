require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");

const { createOrder, fetchOrder, verifyWebhookSignature } = require("./lib/cashfree");
const { sendProductEmail } = require("./lib/email");
const products = require("./lib/products");
const store = require("./lib/orderStore");

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const FILES_DIR = path.join(__dirname, "private-files");

// ---- Webhook route MUST see the raw body for signature verification, so it
// is registered before the global express.json() parser below. ----
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";

    if (!verifyWebhookSignature(signature, timestamp, rawBody)) {
      console.warn("[webhook] signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    const payload = JSON.parse(rawBody || "{}");
    const orderId = payload && payload.data && payload.data.order && payload.data.order.order_id;
    if (!orderId) {
      return res.status(200).send("No order_id in payload, ignored");
    }

    // Defense in depth: don't trust the webhook payload alone — re-check
    // the order status directly with Cashfree before delivering anything.
    const order = await fetchOrder(orderId);

    if (order.order_status === "PAID") {
      const record = store.get(orderId) || {};
      if (!record.delivered) {
        const productId = record.product || (order.order_tags && order.order_tags.product);
        const email = record.email || (order.customer_details && order.customer_details.customer_email);
        const name = record.name || (order.customer_details && order.customer_details.customer_name);

        if (productId && email) {
          try {
            await sendProductEmail({ to: email, name, productId });
            store.update(orderId, { delivered: true });
          } catch (emailErr) {
            console.error("[webhook] email delivery failed for order", orderId, emailErr);
          }
        } else {
          console.warn("[webhook] missing productId or email for order", orderId);
        }
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("[webhook] error:", err);
    res.status(500).send("error");
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (req, res) => res.send("ok"));

app.post("/api/create-order", async (req, res) => {
  try {
    const { product, name, email, phone } = req.body || {};
    const productInfo = products[product];

    if (!productInfo) return res.status(400).json({ error: "Unknown product." });
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email and phone are all required." });
    }

    const orderId = `cc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const cfOrder = await createOrder({
      order_id: orderId,
      order_amount: productInfo.price,
      order_currency: "INR",
      customer_details: {
        customer_id: crypto.createHash("sha256").update(email).digest("hex").slice(0, 16),
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
      },
      order_meta: {
        return_url: `${SITE_URL}/success.html?order_id=${orderId}`,
      },
      order_tags: { product },
    });

    store.save(orderId, { product, name, email, phone, delivered: false });

    res.json({ order_id: cfOrder.order_id, payment_session_id: cfOrder.payment_session_id });
  } catch (err) {
    console.error("[create-order] error:", err);
    res.status(500).json({ error: "Could not start payment. Please try again in a moment." });
  }
});

app.get("/api/order-status", async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: "order_id is required." });

    const order = await fetchOrder(order_id);
    const record = store.get(order_id) || {};

    res.json({ status: order.order_status, product: record.product || null });
  } catch (err) {
    console.error("[order-status] error:", err);
    res.status(500).json({ error: "Could not check order status." });
  }
});

app.get("/api/download", async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).send("order_id is required.");

    const order = await fetchOrder(order_id);
    if (order.order_status !== "PAID") {
      return res.status(402).send("Payment not confirmed yet.");
    }

    const record = store.get(order_id) || {};
    const productId = record.product || (order.order_tags && order.order_tags.product);
    const productInfo = products[productId];
    if (!productInfo) return res.status(404).send("Product not found for this order.");

    const existingFiles = productInfo.files.filter((f) => fs.existsSync(path.join(FILES_DIR, f)));
    if (existingFiles.length === 0) {
      return res.status(404).send("Your file isn't ready yet — check your email or contact support.");
    }

    if (existingFiles.length === 1) {
      return res.download(path.join(FILES_DIR, existingFiles[0]), existingFiles[0]);
    }

    // Bundle with more than one file: zip on the fly.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="the-cozy-corner-bundle.zip"');
    const archive = archiver("zip");
    archive.on("error", (err) => {
      console.error("[download] zip error:", err);
      res.status(500).end();
    });
    archive.pipe(res);
    for (const f of existingFiles) {
      archive.file(path.join(FILES_DIR, f), { name: f });
    }
    archive.finalize();
  } catch (err) {
    console.error("[download] error:", err);
    res.status(500).send("Could not process download.");
  }
});

app.listen(PORT, () => {
  console.log(`The Cozy Corner site running on port ${PORT} (${process.env.CASHFREE_ENV || "SANDBOX"} mode)`);
});
