const express = require("express");
const router = express.Router();
const { authRequired, roleRequired } = require("../middleware/auth");
const frappe = require("../services/frappeClient");

// HR can view a Frappe DocType list (change "Employee" to your doctype)
router.get(
  "/hr/frappe/:doctype",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { doctype } = req.params;
      const { fields, filters, limit_start, limit_page_length, order_by } =
        req.query;

      const data = await frappe.listDocType(doctype, {
        fields: fields || '["name"]',
        filters: filters || "[]",
        limit_start: limit_start || 0,
        limit_page_length: limit_page_length || 20,
        order_by: order_by || "modified desc",
      });

      res.json(data);
    } catch (err) {
      res
        .status(err.status || 500)
        .json({ message: err.message, details: err.data || null });
    }
  },
);

// create document in a doctype
router.post(
  "/hr/frappe/:doctype",
  authRequired,
  roleRequired("HR"),
  async (req, res) => {
    try {
      const { doctype } = req.params;
      const data = await frappe.createDoc(doctype, req.body);
      res.status(201).json(data);
    } catch (err) {
      res
        .status(err.status || 500)
        .json({ message: err.message, details: err.data || null });
    }
  },
);

module.exports = router;
