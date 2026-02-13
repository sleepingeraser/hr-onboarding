const axios = require("axios");

class FrappeApiService {
  constructor() {
    this.baseURL = process.env.FRAPPE_BASE_URL || "http://your-frappe-site.com";
    this.apiKey = process.env.FRAPPE_API_KEY || "d05c45530fda551";
    this.apiSecret = process.env.FRAPPE_API_SECRET || "2e4d8f6d1fad2b5";

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  // token-based authentication (recommended for server-to-server)
  getAuthHeader() {
    const token = `${this.apiKey}:${this.apiSecret}`;
    return `token ${token}`;
  }

  // generic request method with auth
  async request(method, endpoint, data = null, params = null) {
    try {
      const response = await this.client({
        method,
        url: endpoint,
        data,
        params,
        headers: {
          Authorization: this.getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      console.error("Frappe API Error:", error.response?.data || error.message);
      throw error;
    }
  }

  // CRUD operations for DocTypes
  async getDocuments(doctype, options = {}) {
    const { fields, filters, order_by, limit_start, limit_page_length } =
      options;
    const params = {};

    if (fields) params.fields = JSON.stringify(fields);
    if (filters) params.filters = JSON.stringify(filters);
    if (order_by) params.order_by = order_by;
    if (limit_start) params.limit_start = limit_start;
    if (limit_page_length) params.limit_page_length = limit_page_length;

    return this.request("GET", `/api/resource/${doctype}`, null, params);
  }

  async getDocument(doctype, name, expand_links = false) {
    const params = expand_links ? { expand_links: "True" } : null;
    return this.request(
      "GET",
      `/api/resource/${doctype}/${name}`,
      null,
      params,
    );
  }

  async createDocument(doctype, data) {
    return this.request("POST", `/api/resource/${doctype}`, data);
  }

  async updateDocument(doctype, name, data) {
    return this.request("PUT", `/api/resource/${doctype}/${name}`, data);
  }

  async deleteDocument(doctype, name) {
    return this.request("DELETE", `/api/resource/${doctype}/${name}`);
  }

  // remote method calls
  async callMethod(methodPath, data = null, method = "GET") {
    return this.request(method, `/api/method/${methodPath}`, data);
  }

  // file upload
  async uploadFile(fileBuffer, fileName, doctype = null, docname = null) {
    const formData = new FormData();
    formData.append("file", fileBuffer, fileName);
    if (doctype) formData.append("doctype", doctype);
    if (docname) formData.append("docname", docname);

    try {
      const response = await this.client.post(
        "/api/method/upload_file",
        formData,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            ...formData.getHeaders(),
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error("File upload error:", error);
      throw error;
    }
  }
}

module.exports = new FrappeApiService();
