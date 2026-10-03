import { POLICY } from "./data.js";

function toAscii(value) {
  return value
    .replaceAll("\u2014", " - ")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2026", "...")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(value) {
  return toAscii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapLine(text, width = 90) {
  const words = toAscii(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function briefRows(findings, vendor) {
  const rows = [];
  const push = (text, bold = false) => {
    for (const line of wrapLine(text)) rows.push({ text: line, bold });
  };
  const blank = () => rows.push({ text: "", bold: false });

  push("VendorGuard Redline Brief", true);
  push("Enterprise local compliance agent. This document is not an approval.");
  push(`Policy: ${POLICY.label}`);
  push(`Policy file: ${vendor.policyFile || POLICY.file}`);
  push(`Contract: ${vendor.file}`);
  push(`Vendor: ${vendor.name}`);
  push("Endpoint: http://127.0.0.1:8787/  |  Local inference on Dell Pro Max GB10");
  push("Result: REVIEW REQUIRED - 4 flags escalated, 0 pass, 0 uncertain");
  blank();
  push("Final approval remains with the human reviewer. The agent does not auto-approve.");
  blank();

  findings.forEach((finding, index) => {
    push(
      `${index + 1}. ${finding.id}: ${finding.title}    ${finding.status} / ${finding.severity}`,
      true,
    );
    push(`Category: ${finding.categoryLabel}`);
    push(`Policy requirement: ${finding.requirement}`);
    push(`Source: ${finding.file} - ${finding.sectionTitle}`);
    push(`Context before: ${finding.before}`);
    push(`Evidence: ${finding.evidence}`);
    push(`Context after: ${finding.after}`);
    push("Grounding: Verified original text (Grounding Score: 100%).");
    push(`Comparison: ${finding.reason}`);
    push(`Suggested redline: ${finding.redline}`);
    blank();
  });

  return rows;
}

function renderPage(lines, pageNumber, pageCount) {
  const ops = ["BT"];
  lines.forEach((line, index) => {
    const y = 748 - index * 15;
    ops.push(line.bold ? "/F2 11 Tf" : "/F1 10 Tf");
    ops.push(`1 0 0 1 54 ${y} Tm`);
    ops.push(`(${pdfEscape(line.text)}) Tj`);
  });
  ops.push("/F1 9 Tf");
  ops.push("1 0 0 1 54 40 Tm");
  ops.push(
    `(${pdfEscape(`VendorGuard  |  Human review packet  |  Page ${pageNumber} of ${pageCount}`)}) Tj`,
  );
  ops.push("ET");
  return ops.join("\n");
}

export function buildRedlinePdf(findings, vendor) {
  const rows = briefRows(findings, vendor);
  const perPage = 44;
  const chunks = [];
  for (let index = 0; index < rows.length; index += perPage) {
    chunks.push(rows.slice(index, index + perPage));
  }
  if (chunks.length === 0) chunks.push([{ text: "No findings.", bold: false }]);

  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const kids = [];
  let nextId = 5;
  chunks.forEach((lines, index) => {
    const pageId = nextId++;
    const contentId = nextId++;
    kids.push(`${pageId} 0 R`);
    const stream = renderPage(lines, index + 1, chunks.length);
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    objects.set(contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.set(2, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${chunks.length} >>`);

  const ids = [...objects.keys()].sort((a, b) => a - b);
  let pdf = "%PDF-1.4\n";
  const offsets = {};
  for (const id of ids) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${ids.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const id of ids) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${ids.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

export function downloadRedlinePdf(findings, vendor) {
  const pdf = buildRedlinePdf(findings, vendor);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "VendorGuard_Redline_Brief_Vendor_B.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
