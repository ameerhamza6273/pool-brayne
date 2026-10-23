// Client video 2026-10-23: the invoice/estimate email carries the whole document as a PDF ("if they
// click the PDF ... they'll see the entire work ticket"). Renders the on-screen document element
// to an image (html2canvas) and paginates it onto Letter pages (jsPDF) -- both loaded on demand.
// Anything marked `print:hidden` (staff-only sections, status badges) is left out, same as printing.
export async function elementToPdfBase64(el: HTMLElement): Promise<string> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    ignoreElements: (node) => node instanceof HTMLElement && node.classList.contains("print:hidden"),
  });
  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  // Slice the tall canvas into page-sized strips so nothing is scaled down to fit one page.
  const pxPerPt = canvas.width / contentW;
  const sliceH = Math.floor(contentH * pxPerPt);
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const h = Math.min(sliceH, canvas.height - y);
    const strip = document.createElement("canvas");
    strip.width = canvas.width;
    strip.height = h;
    strip.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(strip.toDataURL("image/jpeg", 0.85), "JPEG", margin, margin, contentW, h / pxPerPt);
  }
  return pdf.output("datauristring").split(",")[1];
}
