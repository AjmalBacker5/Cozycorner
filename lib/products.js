// Product catalog — the single source of truth for names, prices, and which
// file(s) get delivered for each product. Edit here if prices or filenames change.

module.exports = {
  module: {
    id: "module",
    name: "The Dropshipping Module",
    price: 299,
    files: ["dropshipping-module.pdf"],
  },
  contacts: {
    id: "contacts",
    name: "Sellers Contact List",
    price: 199,
    files: ["sellers-contact-list.xlsx"],
  },
  bundle: {
    id: "bundle",
    name: "Module + Contact List Bundle",
    price: 449,
    files: ["dropshipping-module.pdf", "sellers-contact-list.xlsx"],
  },
};
