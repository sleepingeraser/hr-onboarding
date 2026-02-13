const frappe = require("../services/frappeClient");

class FaqsModel {
  async listActiveFaqs() {
    try {
      const response = await frappe.listDocType("FAQ", {
        fields: JSON.stringify([
          "name",
          "question",
          "answer",
          "category",
          "creation",
          "published",
        ]),
        filters: JSON.stringify([["published", "=", 1]]),
        order_by: "creation desc",
      });

      return response.data.map((doc) => ({
        FaqId: doc.name,
        Question: doc.question,
        Answer: doc.answer,
        Category: doc.category || "General",
        IsActive: doc.published ? 1 : 0,
        CreatedAt: doc.creation,
      }));
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      return [];
    }
  }

  async createFaq({ question, answer, category }) {
    return await frappe.createDoc("FAQ", {
      question,
      answer,
      category: category || "General",
      published: 1,
    });
  }

  async deactivateFaq(id) {
    return await frappe.updateDoc("FAQ", id, {
      published: 0,
    });
  }

  async listAllFaqs() {
    try {
      const response = await frappe.listDocType("FAQ", {
        fields: JSON.stringify([
          "name",
          "question",
          "answer",
          "category",
          "published",
          "creation",
        ]),
        order_by: "creation desc",
      });

      return response.data.map((doc) => ({
        FaqId: doc.name,
        Question: doc.question,
        Answer: doc.answer,
        Category: doc.category || "General",
        IsActive: doc.published ? 1 : 0,
        CreatedAt: doc.creation,
      }));
    } catch (error) {
      console.error("Error fetching all FAQs:", error);
      return [];
    }
  }
}

module.exports = new FaqsModel();
