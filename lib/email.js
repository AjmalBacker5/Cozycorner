// Sends the purchased file(s) by email via Resend once a payment is confirmed.
// If a product file hasn't been added to private-files/ yet, the email still
// goes out (without the attachment) so the buyer gets a confirmation, and a
// warning is logged so the site owner notices and can follow up manually.

const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const products = require("./products");

const FILES_DIR = path.join(__dirname, "..", "private-files");

function client() {
  return new Resend(process.env.RESEND_API_KEY);
}

function buildEmailHtml({ name, productInfo, hasAttachment }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1B1F2A;">
      <h2 style="margin-bottom:4px;">Thanks for your order, ${name || "there"}!</h2>
      <p>Your payment for <strong>${productInfo.name}</strong> (₹${productInfo.price}) is confirmed.</p>
      ${
        hasAttachment
          ? `<p>Your file${productInfo.files.length > 1 ? "s are" : " is"} attached to this email.</p>`
          : `<p>We're finalising your file and will follow up with it shortly.</p>`
      }
      <p style="margin-top:24px;">Questions? Just reply to this email.</p>
      <p style="color:#66604F;">— The Cozy Corner</p>
    </div>
  `;
}

async function sendProductEmail({ to, name, productId }) {
  const productInfo = products[productId];
  if (!productInfo) throw new Error(`Unknown product for email: ${productId}`);

  const attachments = [];
  for (const fileName of productInfo.files) {
    const filePath = path.join(FILES_DIR, fileName);
    if (fs.existsSync(filePath)) {
      attachments.push({
        filename: fileName,
        content: fs.readFileSync(filePath).toString("base64"),
      });
    } else {
      console.warn(
        `[email] Missing product file "${filePath}" — sending confirmation without attachment. Add the real file to private-files/ and resend manually.`
      );
    }
  }

  const fromEmail = process.env.FROM_EMAIL || "orders@thecozycorner.in";

  await client().emails.send({
    from: `The Cozy Corner <${fromEmail}>`,
    to,
    subject: `Your ${productInfo.name} from The Cozy Corner`,
    html: buildEmailHtml({ name, productInfo, hasAttachment: attachments.length > 0 }),
    attachments,
  });
}

module.exports = { sendProductEmail };
