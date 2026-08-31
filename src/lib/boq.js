import PDFDocument from "pdfkit";

function money(value) {
  return `N${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function generateBOQPDF(requisition, requesterUser) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(16).text("KADUNA STATE UNIVERSITY", { align: "center" });
      doc.fontSize(13).text("BILL OF QUANTITIES", { align: "center" });
      doc.moveDown();
      doc.fontSize(9)
        .text(`Requisition No: ${requisition.requisitionNumber || "-"}`)
        .text(`Requester: ${requesterUser?.fullName || requisition.requester?.fullName || "-"}`)
        .text(`Date: ${new Date().toLocaleDateString("en-NG")}`);
      doc.moveDown();

      const x = [45, 75, 285, 330, 405, 500];
      doc.fontSize(8).font("Helvetica-Bold");
      ["S/N", "Description", "Qty", "Unit Cost", "Total", "Reason"].forEach((h, i) => doc.text(h, x[i], doc.y, { width: i === 1 ? 42 : 65 }));
      doc.moveDown(.5);
      doc.font("Helvetica");

      let grand = 0;
      (requisition.items || []).forEach((item, index) => {
        const unit = Number(item.procurementUnitCost ?? item.unitCost ?? 0);
        const total = Number(item.quantity || 0) * unit;
        grand += total;
        const y = doc.y;
        doc.text(String(index + 1), x[0], y, { width: 25 });
        doc.text(String(item.name || "-"), x[1], y, { width: 200 });
        doc.text(String(item.quantity || 0), x[2], y, { width: 55 });
        doc.text(money(unit), x[3], y, { width: 70 });
        doc.text(money(total), x[4], y, { width: 90 });
        doc.text(String(item.procurementNote || "-"), x[5], y, { width: 45 });
        doc.moveDown(1.2);
        if (doc.y > 720) doc.addPage();
      });

      doc.moveDown();
      doc.font("Helvetica-Bold").text(`GRAND TOTAL: ${money(grand)}`, { align: "right" });
      if (requisition.procurementNotes) {
        doc.moveDown();
        doc.font("Helvetica-Bold").text("Procurement Notes");
        doc.font("Helvetica").text(requisition.procurementNotes);
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
                                                                                                                }
