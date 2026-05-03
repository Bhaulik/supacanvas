import { defineContentScript } from "wxt/sandbox";

interface CaptureMessage {
  type: "capture";
  mode: "selection" | "page";
}

interface CapturedPayload {
  html: string;
  title: string;
  url: string;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: CaptureMessage, _sender, sendResponse) => {
      if (!message || message.type !== "capture") return false;
      const html = message.mode === "selection" ? getSelectionHtml() : document.body.outerHTML;
      const payload: CapturedPayload = {
        html: stripUnsafe(html),
        title: document.title,
        url: location.href,
      };
      sendResponse(payload);
      return false;
    });
  },
});

function getSelectionHtml(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return "";
  const range = sel.getRangeAt(0);
  const div = document.createElement("div");
  div.appendChild(range.cloneContents());
  return div.innerHTML;
}

// Drop <script> tags and inline event handlers; keep structure & inline styles.
// Supacanvas sandboxes the iframe so this is defense-in-depth, not the primary
// safety boundary.
function stripUnsafe(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, noscript, iframe, object, embed, link[rel='import']").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
      if (attr.name === "href" && attr.value.toLowerCase().startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body ? doc.body.innerHTML : html;
}
