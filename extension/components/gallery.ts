import {
  galleryUrl,
  listCanvases,
  listFolders,
  type CanvasSummary,
  type FolderEntry,
} from "./api";
import { renderCard } from "./canvas-card";

interface GalleryState {
  search: string;
  folder: string | null; // null = all, "" = root, "name" = specific
  canvases: CanvasSummary[];
  folders: FolderEntry[];
  loading: boolean;
  errorKind: "none" | "server-down" | "other";
  errorMessage: string;
}

export function mountGallery(root: HTMLElement): { dispose: () => void } {
  const state: GalleryState = {
    search: "",
    folder: null,
    canvases: [],
    folders: [],
    loading: true,
    errorKind: "none",
    errorMessage: "",
  };

  root.innerHTML = `
    <div class="app">
      <header class="masthead">
        <div class="masthead__row">
          <div class="masthead__title">
            <span class="masthead__num">№</span>
            <span class="masthead__word">Supa Canvas</span>
          </div>
          <button class="iconbtn" data-role="refresh" title="Refresh now" aria-label="Refresh">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.79"/>
              <path d="M13.5 2v3h-3"/>
            </svg>
          </button>
        </div>
        <div class="masthead__sub">Local gallery · localhost:7777</div>
      </header>
      <div class="controls">
        <input class="search" type="search" placeholder="Search title, description, tags…" data-role="search" autocomplete="off" />
        <div class="chips" data-role="chips"></div>
      </div>
      <div class="scroll" data-role="scroll">
        <div class="grid" data-role="grid"></div>
        <div class="empty" data-role="empty" hidden></div>
        <div class="spinner" data-role="spinner">Loading…</div>
      </div>
      <div class="foot-bar">
        <a class="foot-link foot-link--accent" data-role="open-gallery" href="${galleryUrl()}" target="_blank" rel="noreferrer">
          Open Gallery
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px">
            <path d="M5 3h8v8"/><path d="M13 3 3 13"/>
          </svg>
        </a>
        <span class="foot-status" data-role="status"></span>
      </div>
    </div>
  `;

  const $search = root.querySelector<HTMLInputElement>('[data-role="search"]')!;
  const $chips = root.querySelector<HTMLDivElement>('[data-role="chips"]')!;
  const $grid = root.querySelector<HTMLDivElement>('[data-role="grid"]')!;
  const $empty = root.querySelector<HTMLDivElement>('[data-role="empty"]')!;
  const $spinner = root.querySelector<HTMLDivElement>('[data-role="spinner"]')!;
  const $openGallery = root.querySelector<HTMLAnchorElement>('[data-role="open-gallery"]')!;
  const $refresh = root.querySelector<HTMLButtonElement>('[data-role="refresh"]')!;
  const $status = root.querySelector<HTMLSpanElement>('[data-role="status"]')!;

  $openGallery.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: state.folder ? galleryUrl(state.folder) : galleryUrl() });
  });

  $refresh.addEventListener("click", () => {
    refreshFolders();
    refreshCanvases();
  });

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  $search.addEventListener("input", () => {
    state.search = $search.value.trim();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refreshCanvases(), 180);
  });

  async function refreshFolders(): Promise<void> {
    try {
      state.folders = await listFolders();
    } catch {
      state.folders = [];
    }
    renderChips();
  }

  async function refreshCanvases(): Promise<void> {
    state.loading = state.canvases.length === 0;
    renderShell();
    try {
      const opts: Parameters<typeof listCanvases>[0] = {};
      if (state.search) opts.search = state.search;
      if (state.folder !== null) {
        opts.folder = state.folder;
        if (state.folder !== "") opts.descendants = true;
      }
      const next = await listCanvases(opts);
      state.canvases = next;
      state.errorKind = "none";
      state.errorMessage = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "SERVER_UNREACHABLE") {
        state.errorKind = "server-down";
      } else {
        state.errorKind = "other";
        state.errorMessage = msg;
      }
      state.canvases = [];
    } finally {
      state.loading = false;
      renderShell();
      renderStatus();
    }
  }

  function renderStatus(): void {
    if (state.errorKind !== "none") {
      $status.textContent = "";
      return;
    }
    const n = state.canvases.length;
    $status.textContent = n === 1 ? "1 canvas" : `${n} canvases`;
  }

  function renderChips(): void {
    $chips.innerHTML = "";
    const all = makeChip("All", state.folder === null, () => {
      state.folder = null;
      refreshCanvases();
      renderChips();
    });
    $chips.appendChild(all);

    if (state.folders.some((f) => f.name === "")) {
      const root = makeChip("Root", state.folder === "", () => {
        state.folder = "";
        refreshCanvases();
        renderChips();
      });
      $chips.appendChild(root);
    }

    for (const f of state.folders) {
      if (!f.name) continue;
      const chip = makeChip(f.name, state.folder === f.name, () => {
        state.folder = f.name;
        refreshCanvases();
        renderChips();
      }, f.count);
      $chips.appendChild(chip);
    }
  }

  function makeChip(label: string, active: boolean, onClick: () => void, count?: number): HTMLButtonElement {
    const el = document.createElement("button");
    el.className = "chip" + (active ? " chip--active" : "");
    el.textContent = label;
    if (typeof count === "number") {
      const c = document.createElement("span");
      c.className = "chip__count";
      c.textContent = String(count);
      el.appendChild(c);
    }
    el.addEventListener("click", onClick);
    return el;
  }

  function renderShell(): void {
    $spinner.hidden = !state.loading;
    if (state.loading) {
      $grid.hidden = true;
      $empty.hidden = true;
      return;
    }

    if (state.errorKind === "server-down") {
      $grid.hidden = true;
      $empty.hidden = false;
      $empty.innerHTML = `
        <div class="empty__title">Server isn't running</div>
        <div class="empty__hint">Open a terminal and run:</div>
        <div class="empty__cmd">supacanvas serve</div>
        <div class="empty__hint">Then click ↻ above.</div>
      `;
      return;
    }

    if (state.errorKind === "other") {
      $grid.hidden = true;
      $empty.hidden = false;
      $empty.innerHTML = `
        <div class="empty__title">Couldn't load canvases</div>
        <div class="empty__hint">${escapeHtml(state.errorMessage)}</div>
      `;
      return;
    }

    if (state.canvases.length === 0) {
      $grid.hidden = true;
      $empty.hidden = false;
      $empty.innerHTML = state.search
        ? `<div class="empty__title">No matches</div>
           <div class="empty__hint">No canvases match "${escapeHtml(state.search)}"</div>`
        : `<div class="empty__title">No canvases yet</div>
           <div class="empty__hint">Ask any AI tool with the supacanvas MCP installed to create one. Or right-click anything on a webpage → <em>Save to Supacanvas</em>.</div>`;
      return;
    }

    $empty.hidden = true;
    $grid.hidden = false;
    $grid.innerHTML = "";
    for (const c of state.canvases) {
      $grid.appendChild(renderCard(c, { width: 360, height: 225 }));
    }
  }

  // initial load
  refreshFolders();
  refreshCanvases();

  // Side panel polls every 30s so changes from AI tools show up.
  const pollHandle = setInterval(() => {
    refreshFolders();
    refreshCanvases();
  }, 30_000);

  return {
    dispose() {
      clearInterval(pollHandle);
      if (searchTimer) clearTimeout(searchTimer);
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
