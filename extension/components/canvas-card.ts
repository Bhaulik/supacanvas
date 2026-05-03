import { canvasThumbnailUrl, canvasViewerUrl, type CanvasSummary } from "./api";

export interface CardOptions {
  /** Thumbnail width in CSS pixels. */
  width?: number;
  /** Thumbnail height in CSS pixels. */
  height?: number;
}

export function renderCard(canvas: CanvasSummary, opts: CardOptions = {}): HTMLElement {
  const w = opts.width ?? 320;
  const h = opts.height ?? 200;

  const card = document.createElement("a");
  card.className = "card";
  card.href = canvasViewerUrl(canvas.id);
  card.target = "_blank";
  card.rel = "noreferrer";
  card.dataset.canvasId = canvas.id;

  const thumb = document.createElement("div");
  thumb.className = "card__thumb";
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.alt = canvas.title;
  img.src = canvasThumbnailUrl(canvas.id, w, h);
  img.addEventListener("error", () => {
    img.remove();
    thumb.classList.add("card__thumb--fallback");
    thumb.textContent = canvas.title.slice(0, 1).toUpperCase();
  });
  thumb.appendChild(img);

  const body = document.createElement("div");
  body.className = "card__body";

  const title = document.createElement("div");
  title.className = "card__title";
  title.textContent = canvas.title || "Untitled";
  body.appendChild(title);

  if (canvas.description) {
    const desc = document.createElement("div");
    desc.className = "card__desc";
    desc.textContent = canvas.description;
    body.appendChild(desc);
  }

  const foot = document.createElement("div");
  foot.className = "card__foot";

  if (canvas.folder) {
    const folder = document.createElement("span");
    folder.className = "card__folder";
    folder.textContent = canvas.folder;
    foot.appendChild(folder);
  }

  const stamp = document.createElement("span");
  stamp.className = "card__stamp";
  stamp.textContent = relativeTime(canvas.updatedAt);
  foot.appendChild(stamp);

  body.appendChild(foot);

  card.appendChild(thumb);
  card.appendChild(body);

  card.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: canvasViewerUrl(canvas.id) });
  });

  return card;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
