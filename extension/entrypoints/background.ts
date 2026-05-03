import { defineBackground } from "wxt/sandbox";

const SERVER_URL = "http://localhost:7777";
const CAPTURE_FOLDER = "captures";
const CONTEXT_MENU_ID = "save-to-supacanvas";

interface ApiRequest {
  type: "api";
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

interface CaptureMessage {
  type: "capture";
  mode: "selection" | "page";
}

interface CapturedPayload {
  html: string;
  title: string;
  url: string;
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Save to Supacanvas",
      contexts: ["page", "selection"],
    });
  });

  // Toolbar click opens the side panel directly on the right edge of the window.
  // Chrome 116+: setPanelBehavior makes the action button auto-open the panel.
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  // Chrome 114–115 fallback: setPanelBehavior is a no-op there, but action.onClicked
  // fires when there's no default_popup, and sidePanel.open() works from 114+.
  chrome.action.onClicked.addListener((tab) => {
    if (typeof tab.id === "number") {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    const m = message as ApiRequest | { type: "open-side-panel"; tabId?: number };

    if (m.type === "api") {
      handleApi(m as ApiRequest)
        .then((result) => sendResponse({ ok: true, status: 200, data: result }))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          sendResponse({
            ok: false,
            status: 0,
            error: serverHint(message),
          });
        });
      return true; // keep the channel open for async response
    }

    if (m.type === "open-side-panel") {
      openSidePanel((m as { tabId?: number }).tabId)
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    return false;
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    if (!tab?.id) return;
    const mode: "selection" | "page" = info.selectionText ? "selection" : "page";
    try {
      const captured = (await chrome.tabs.sendMessage(tab.id, {
        type: "capture",
        mode,
      } satisfies CaptureMessage)) as CapturedPayload;
      const meta = await saveCapture(captured, mode);
      await notifyCaptureSuccess(meta.id, meta.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyCaptureFailure(msg);
    }
  });
});

async function handleApi(req: ApiRequest): Promise<unknown> {
  const url = `${SERVER_URL}${req.path}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
  };
  if (req.body !== undefined) init.body = JSON.stringify(req.body);
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function serverHint(rawMessage: string): string {
  if (
    rawMessage.includes("Failed to fetch") ||
    rawMessage.includes("ECONNREFUSED") ||
    rawMessage.includes("NetworkError")
  ) {
    return "SERVER_UNREACHABLE";
  }
  return rawMessage;
}

interface CapturePayload {
  id: string;
  title: string;
}

async function saveCapture(captured: CapturedPayload, mode: "selection" | "page"): Promise<CapturePayload> {
  const cleanedHtml = wrapCapturedHtml(captured);
  const titleSeed =
    mode === "selection"
      ? (captured.title || stripTags(captured.html).trim().slice(0, 60) || "Captured selection")
      : captured.title || captured.url || "Captured page";
  const title = titleSeed.slice(0, 120);
  const description = `Captured from ${captured.url}`;

  const meta = await handleApi({
    type: "api",
    method: "POST",
    path: "/api/canvases",
    body: {
      title,
      description,
      html: cleanedHtml,
      source: "chrome-extension:supacanvas",
      folder: CAPTURE_FOLDER,
      tags: ["captured", mode],
    },
  } as ApiRequest);

  const m = meta as { id: string; title: string };
  return { id: m.id, title: m.title };
}

function wrapCapturedHtml(captured: CapturedPayload): string {
  // Wrap the captured HTML in a simple frame that records provenance.
  // Inline styles are kept; external stylesheets and scripts are dropped
  // by the content script side already.
  const safeUrl = escapeHtml(captured.url);
  const safeTitle = escapeHtml(captured.title || captured.url);
  return `<article class="captured">
  <header class="captured__meta">
    <strong>${safeTitle}</strong>
    <a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>
  </header>
  <div class="captured__body">${captured.html}</div>
</article>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

async function notifyCaptureSuccess(id: string, title: string): Promise<void> {
  const url = `${SERVER_URL}/c/${id}`;
  const notificationId = `supacanvas-capture-${id}`;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon/128.png"),
    title: "Saved to Supacanvas",
    message: title,
    contextMessage: url,
    priority: 1,
  });
  const listener = (clickedId: string) => {
    if (clickedId !== notificationId) return;
    chrome.tabs.create({ url });
    chrome.notifications.clear(notificationId);
    chrome.notifications.onClicked.removeListener(listener);
  };
  chrome.notifications.onClicked.addListener(listener);
}

async function notifyCaptureFailure(message: string): Promise<void> {
  const friendly =
    message === "SERVER_UNREACHABLE"
      ? "Couldn't reach localhost:7777. Run `supacanvas serve` first."
      : message;
  await chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon/128.png"),
    title: "Capture failed",
    message: friendly,
    priority: 2,
  });
}

async function openSidePanel(tabId?: number): Promise<void> {
  if (!chrome.sidePanel?.open) {
    throw new Error("Side panel API unavailable in this Chrome version.");
  }
  const targetTabId =
    tabId ??
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (typeof targetTabId !== "number") {
    throw new Error("No active tab to anchor the side panel to.");
  }
  await chrome.sidePanel.open({ tabId: targetTabId });
}
