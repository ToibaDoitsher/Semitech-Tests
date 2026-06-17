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
.page-title { font-size: 16pt; font-weight: 700; margin-bottom: 4mm; }
.summary { margin-bottom: 3mm; font-size: 10pt; color: #4b5563; }
`;

/** פותח מסמך הדפסה ב-iframe (לא חלון חדש — עובד גם כשחוסמים popups) */
export function openPrintDocument({
  title,
  bodyHtml,
  styles,
}: {
  title: string;
  bodyHtml: string;
  /** CSS מלא — אם לא מועבר, משתמשים ב-BASE_PRINT_STYLES */
  styles?: string;
}) {
  const css = styles ?? BASE_PRINT_STYLES;
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
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

  const waitForImages = () =>
    new Promise<void>((resolve) => {
      const imgs = win.document.querySelectorAll("img");
      if (!imgs.length) {
        resolve();
        return;
      }
      let pending = imgs.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) resolve();
      };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      });
    });

  const triggerPrint = () => {
    void waitForImages().then(() => {
      try {
        win.focus();
        win.print();
      } catch {
        alert("הדפסה נכשלה. נסי שוב.");
      } finally {
        cleanup();
      }
    });
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
