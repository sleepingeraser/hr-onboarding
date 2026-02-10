const faqsModel = require("../models/faqsModel");

async function listFaqs(req, res) {
  try {
    const faqs = await faqsModel.listActiveFaqs();
    res.json({ faqs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrCreateFaq(req, res) {
  try {
    const { question, answer, category } = req.body || {};
    if (!question || !answer)
      return res.status(400).json({ message: "Missing question/answer" });

    await faqsModel.createFaq({ question, answer, category });
    res.status(201).json({ message: "FAQ created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrDeactivateFaq(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    await faqsModel.deactivateFaq(id);
    res.json({ message: "Deactivated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

async function hrListAllFaqs(req, res) {
  try {
    const faqs = await faqsModel.listAllFaqs();
    res.json({ faqs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { listFaqs, hrCreateFaq, hrDeactivateFaq, hrListAllFaqs };
