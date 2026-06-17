"use client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapePrintText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return escapeHtml(String(value));
}

const BASE_PRINT_STYLES = `
@page { size: A4; margin: 10mm; }
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
table { width: 100%; border-collapse: collapse; font-size: 11pt; }
th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
th { background: #f1f5f9; }
.labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
.label-item { box-sizing: border-box; border: 1px dashed #e5e7eb; padding: 3mm 2mm; height: 24mm; overflow: hidden; font-size: 9pt; }
.label-title { font-weight: 700; margin-bottom: 2px; }
.label-line { line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-title { font-size: 16pt; font-weight: 700; margin-bottom: 4mm; }
.summary { margin-bottom: 3mm; font-size: 10pt; color: #4b5563; }
`;

/** פותח מסמך הדפסה ב-iframe (לא חלון חדש — עובד גם כשחוסמים popups) */
export function openPrintDocument({
  title,
  bodyHtml,
  extraHead = "",
}: {
  title: string;
  bodyHtml: string;
  extraHead?: string;
}) {
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${BASE_PRINT_STYLES}${extraHead}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "none",
    visibility: "hidden",
  });

  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    alert("לא ניתן לפתוח חלון הדפסה. נסי שוב.");
    return;
  }

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      alert("הדפסה נכשלה. נסי שוב.");
    } finally {
      cleanup();
    }
  };

  win.document.open();
  win.document.write(html);
  win.document.close();

  if (win.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 150);
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 150);
  }
}
