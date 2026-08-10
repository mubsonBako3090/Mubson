import PDFDocument from "pdfkit";
import { ROLE_LABELS } from "@/constants/roles";
import { REQUISITION_STATUS_LABELS } from "@/constants/requisitionOptions";

// Builds a requisition PDF and resolves with a Buffer.
export function generateRequisitionPDF(requisition, requesterUser) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("Kaduna State University", { align: "center" });
      doc.fontSize(12).text("Procurement Requisition", { align: "center" });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`Requisition No: ${requisition.requisitionNumber || "DRAFT"}`);
      doc.text(`Status: ${REQUISITION_STATUS_LABELS[requisition.status] || requisition.status}`);
      doc.text(`Requester: ${requesterUser?.fullName || ""}`);
      doc.text(`Department: ${requisition.department}`);
      doc.text(`Category: ${requisition.category || "-"}`);
      doc.text(`Urgency: ${requisition.urgency || "-"}`);
      doc.moveDown();

      doc.text("Purpose / Justification:");
      doc.text(requisition.purpose || "-", { indent: 10 });
      doc.moveDown();

      doc.fontSize(12).text("Items", { underline: true });
      doc.fontSize(10);
      (requisition.items || []).forEach((item, i) => {
        doc.text(
          `${i + 1}. ${item.name} — Qty: ${item.quantity} x N${item.unitCost} = N${item.totalCost}`
        );
      });
      doc.moveDown();
      doc.fontSize(11).text(`Estimated Total: N${requisition.estimatedCost}`, { align: "right" });
      doc.moveDown();

      doc.fontSize(12).text("Approval Chain", { underline: true });
      doc.fontSize(10);
      (requisition.approvalChain || []).forEach((step, i) => {
        doc.text(`${i + 1}. ${ROLE_LABELS[step.role] || step.role}`);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
