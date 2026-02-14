const supabase = require("../config/supabaseConfig");
const path = require("path");
const fs = require("fs");

async function getMyDocuments(req, res) {
  try {
    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", req.user.userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    // transform data to match frontend expectations
    const formattedDocs = (documents || []).map((doc) => ({
      DocId: doc.doc_id,
      DocType: doc.doc_type || "",
      FileUrl: doc.file_url || "",
      Status: doc.status || "PENDING",
      HRComment: doc.hr_comment || "",
      UploadedAt: doc.uploaded_at,
    }));

    res.json({
      success: true,
      documents: formattedDocs,
    });
  } catch (err) {
    console.error("GET my documents error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { docType } = req.body;
    console.log("Uploading document with type:", docType);

    if (!docType) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Document type required",
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const { data, error } = await supabase
      .from("documents")
      .insert([
        {
          user_id: req.user.userId,
          doc_type: docType,
          file_url: fileUrl,
          status: "PENDING",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      fs.unlinkSync(req.file.path);
      throw error;
    }

    console.log("Document uploaded successfully:", data);

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document: {
        DocId: data.doc_id,
        DocType: data.doc_type,
        FileUrl: data.file_url,
        Status: data.status,
      },
    });
  } catch (err) {
    console.error("Upload document error:", err);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
}

async function getPendingDocuments(req, res) {
  try {
    const { data: documents, error } = await supabase
      .from("documents")
      .select(
        `
        doc_id,
        doc_type,
        file_url,
        status,
        hr_comment,
        uploaded_at,
        users!inner (
          user_id,
          name,
          email
        )
      `,
      )
      .eq("status", "PENDING")
      .order("uploaded_at", { ascending: true });

    if (error) throw error;

    // transform data to match expected format
    const formattedDocs = (documents || []).map((doc) => ({
      DocId: doc.doc_id,
      DocType: doc.doc_type || "",
      FileUrl: doc.file_url || "",
      Status: doc.status || "",
      HRComment: doc.hr_comment || "",
      UploadedAt: doc.uploaded_at,
      UserId: doc.users.user_id,
      Name: doc.users.name || "",
      Email: doc.users.email || "",
    }));

    res.json({
      success: true,
      documents: formattedDocs,
    });
  } catch (err) {
    console.error("GET pending docs error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

async function updateDocumentStatus(req, res) {
  try {
    const { docId } = req.params;
    const { status, comment } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED",
      });
    }

    const { error } = await supabase
      .from("documents")
      .update({
        status: status,
        hr_comment: comment || null,
      })
      .eq("doc_id", docId);

    if (error) throw error;

    res.json({
      success: true,
      message: `Document ${status.toLowerCase()}`,
    });
  } catch (err) {
    console.error("PATCH document error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

module.exports = {
  getMyDocuments,
  uploadDocument,
  getPendingDocuments,
  updateDocumentStatus,
};
