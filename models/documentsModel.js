const frappe = require("../services/frappeClient");

class DocumentsModel {
  async createDocument(userId, docType, fileUrl, fileName) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) throw new Error("Employee not found");

      return await frappe.createDoc("Employee Document", {
        employee: employee.name,
        document_type: docType,
        file_name: fileName,
        status: "Pending",
      });
    } catch (error) {
      console.error("Error creating document:", error);
      throw error;
    }
  }

  async listMyDocuments(userId) {
    try {
      const employee = await this.getEmployeeByUserId(userId);
      if (!employee) return [];

      const response = await frappe.listDocType("Employee Document", {
        fields: JSON.stringify([
          "name",
          "document_type",
          "attach",
          "file_name",
          "status",
          "hr_comment",
          "creation",
        ]),
        filters: JSON.stringify([["employee", "=", employee.name]]),
        order_by: "creation desc",
      });

      return response.data.map((doc) => ({
        DocId: doc.name,
        DocType: doc.document_type,
        FileUrl: doc.attach,
        FileName: doc.file_name,
        Status: (doc.status || "Pending").toUpperCase(),
        HRComment: doc.hr_comment,
        UploadedAt: doc.creation,
      }));
    } catch (error) {
      console.error("Error listing documents:", error);
      return [];
    }
  }

  async listPendingDocuments() {
    try {
      const response = await frappe.listDocType("Employee Document", {
        fields: JSON.stringify([
          "name",
          "document_type",
          "attach",
          "file_name",
          "status",
          "hr_comment",
          "creation",
          "employee",
          "employee.employee_name",
          "employee.user_id",
        ]),
        filters: JSON.stringify([["status", "=", "Pending"]]),
        order_by: "creation asc",
      });

      return response.data.map((doc) => ({
        DocId: doc.name,
        DocType: doc.document_type,
        FileUrl: doc.attach,
        FileName: doc.file_name,
        Status: doc.status,
        HRComment: doc.hr_comment,
        UploadedAt: doc.creation,
        UserId: doc.employee_user_id,
        Name: doc.employee_employee_name,
      }));
    } catch (error) {
      console.error("Error listing pending documents:", error);
      return [];
    }
  }

  async reviewDocument(docId, status, comment) {
    try {
      return await frappe.updateDoc("Employee Document", docId, {
        status: status === "APPROVED" ? "Approved" : "Rejected",
        hr_comment: comment,
      });
    } catch (error) {
      console.error("Error reviewing document:", error);
      throw error;
    }
  }

  async getEmployeeByUserId(userId) {
    try {
      const response = await frappe.listDocType("Employee", {
        filters: JSON.stringify([["user_id", "=", userId]]),
      });
      return response.data[0] || null;
    } catch {
      return null;
    }
  }
}

module.exports = new DocumentsModel();
