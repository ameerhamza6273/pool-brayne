import JsBarcode from "jsbarcode";

// Client SMS 2026-09-21: "remove all headers and footers". Printing labels through the browser's
// own print dialog stamps the date, page title, "about:blank" and page number onto every label
// (@page { margin: 0 } didn't stop it on their Zebra setup). A PDF opened in the browser's PDF
// viewer prints with none of that, at exactly the label size, so labels are now generated as
// PDFs. jsPDF is loaded on demand so it isn't part of the main bundle.

export type LabelItem = {
  name: string;
  sku: string;
  price: number | null;
  unit_cost: number;
  item_number?: number | null;
};

const priceOf = (item: LabelItem) => `$${(item.price ?? item.unit_cost).toFixed(2)}`;

// Wraps to at most `maxLines` lines, ending the last with "..." when the name is longer.
function fitLines(doc: import("jspdf").jsPDF, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = doc.splitTextToSize(text, width);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}...`;
  return kept;
}

function barcodeImage(code: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, code, { format: "CODE128", width: 3, height: 90, displayValue: false, margin: 0 });
  return canvas.toDataURL("image/png");
}

// 2" x 1" Zebra label, one label per page: name (up to 2 lines), Code128 barcode, code + price.
export async function zebraLabelsPdfUrl(items: LabelItem[], barcodeSource: "sku" | "itemNumber"): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: [2, 1] });
  items.forEach((item, i) => {
    if (i > 0) doc.addPage([2, 1], "landscape");
    const code = barcodeSource === "itemNumber" && item.item_number != null ? String(item.item_number) : item.sku;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0);
    fitLines(doc, item.name, 1.76, 2).forEach((line, li) => doc.text(line, 0.12, 0.14 + li * 0.1));
    doc.addImage(barcodeImage(code), "PNG", 0.12, 0.36, 1.76, 0.36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(85);
    doc.text(code, 0.12, 0.9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(priceOf(item), 1.88, 0.92, { align: "right" });
  });
  return String(doc.output("bloburl"));
}

// Avery 5160-style sheet: letter paper, 3 columns x 10 rows of 2.625" x 1" labels.
export async function averyLabelsPdfUrl(items: LabelItem[]): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
  const perPage = 30;
  items.forEach((item, i) => {
    if (i > 0 && i % perPage === 0) doc.addPage("letter", "portrait");
    const slot = i % perPage;
    const x = 0.1875 + (slot % 3) * 2.625;
    const y = 0.5 + Math.floor(slot / 3) * 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0);
    fitLines(doc, item.name, 2.3, 2).forEach((line, li) => doc.text(line, x + 0.15, y + 0.3 + li * 0.13));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(85);
    doc.text(item.sku, x + 0.15, y + 0.78);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(priceOf(item), x + 2.475, y + 0.8, { align: "right" });
  });
  return String(doc.output("bloburl"));
}
