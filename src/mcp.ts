import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createCanvas,
  updateCanvas,
  getCanvas,
  listCanvases,
  deleteCanvas,
  listVersions,
  restoreVersion,
  listThemes,
  loadConfig,
  ensureLayout,
} from "./storage.ts";
import { toMarkdown, toStandaloneHtml } from "./export.ts";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const tools: ToolDef[] = [
  {
    name: "canvas_create",
    description:
      "Create a new canvas: a small standalone HTML/CSS/JS view. " +
      "Returns the canvas id and a localhost URL the user can open in a browser. " +
      "JS runs inside a sandboxed iframe (no same-origin, no parent access). " +
      "If the user has `canvas serve` running, the URL renders live. " +
      "ALWAYS write a `description` (1-2 sentences). When the canvas represents specific data, " +
      "a workflow, or has an external source, also write a `context` paragraph — " +
      "another agent (or future you) will read that to understand the canvas without re-deriving it.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Human-readable title shown in the gallery." },
        html: { type: "string", description: "Body HTML. Don't include <html>/<head>/<body>; just the body content." },
        css: { type: "string", description: "Optional CSS. Will be appended after the active theme." },
        js: { type: "string", description: "Optional JS. Runs inside a sandboxed iframe." },
        tags: { type: "array", items: { type: "string" }, description: "Short tags for filtering. Lowercase, hyphen-separated." },
        theme: { type: "string", description: "Theme name. Omit to use the user's default." },
        description: {
          type: "string",
          description:
            "REQUIRED in spirit (default '' is allowed but discouraged). " +
            "1-2 sentences in plain language — what is this canvas? Surfaced in the gallery and to agents listing canvases. " +
            "Example: 'A weekly burndown chart for the Atlas migration, sourced from Jira. " +
            "X axis = sprint, Y axis = open story points.'",
        },
        context: {
          type: "string",
          description:
            "Longer plain-language background for any future reader (human or agent). " +
            "Cover whichever apply: what data is being represented, where the data came from, " +
            "what the user was doing when this canvas was created, what assumptions are baked in, " +
            "what should NOT be changed without checking. Multiple paragraphs welcome. " +
            "Skip if the canvas is purely decorative.",
        },
      },
      required: ["title", "html"],
    },
    async handler(args) {
      const meta = await createCanvas({
        title: String(args.title ?? ""),
        html: String(args.html ?? ""),
        css: typeof args.css === "string" ? args.css : "",
        js: typeof args.js === "string" ? args.js : "",
        tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        theme: typeof args.theme === "string" ? args.theme : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        context: typeof args.context === "string" ? args.context : undefined,
      });
      const cfg = await loadConfig();
      return {
        id: meta.id,
        title: meta.title,
        url: `http://localhost:${cfg.port}/c/${meta.id}`,
      };
    },
  },
  {
    name: "canvas_update",
    description:
      "Update an existing canvas. Provide only fields you want to change. " +
      "The previous version is snapshotted automatically before any change. " +
      "If you change the body of the canvas (html/css/js) in a way that affects what it represents, " +
      "also update `description` and/or `context` so future readers don't see stale text.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        html: { type: "string" },
        css: { type: "string" },
        js: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        theme: { type: "string" },
        description: { type: "string", description: "Plain-language summary (1-2 sentences). Update if what the canvas shows has changed." },
        context: { type: "string", description: "Longer plain-language background for future readers (human or agent). Update when the underlying data, source, or intent changes." },
      },
      required: ["id"],
    },
    async handler(args) {
      const id = String(args.id);
      const result = await updateCanvas(id, {
        title: typeof args.title === "string" ? args.title : undefined,
        html: typeof args.html === "string" ? args.html : undefined,
        css: typeof args.css === "string" ? args.css : undefined,
        js: typeof args.js === "string" ? args.js : undefined,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
        theme: typeof args.theme === "string" ? args.theme : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        context: typeof args.context === "string" ? args.context : undefined,
      });
      const cfg = await loadConfig();
      return {
        id,
        version: result.version,
        url: `http://localhost:${cfg.port}/c/${id}`,
      };
    },
  },
  {
    name: "canvas_get",
    description:
      "Read the full contents (html, css, js, meta) of a canvas. " +
      "Always read `meta.description` and `meta.context` first to understand what the canvas represents " +
      "before editing — they're written for exactly this handoff.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    async handler(args) {
      const c = await getCanvas(String(args.id));
      if (!c) throw new Error(`canvas not found: ${args.id}`);
      return c;
    },
  },
  {
    name: "canvas_list",
    description:
      "List canvases (most recently updated first). Optionally filter by tag or text search. " +
      "Each entry includes `description` so you can identify a canvas without fetching the body. " +
      "Use the `search` filter to find canvases by topic — it matches against title, description, context, and tags.",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string" },
        search: { type: "string" },
        limit: { type: "number" },
      },
    },
    async handler(args) {
      return await listCanvases({
        tag: typeof args.tag === "string" ? args.tag : undefined,
        search: typeof args.search === "string" ? args.search : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      });
    },
  },
  {
    name: "canvas_delete",
    description: "Soft-delete a canvas. Moves it to trash/ — recoverable from disk.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    async handler(args) {
      await deleteCanvas(String(args.id));
      return { ok: true };
    },
  },
  {
    name: "canvas_versions",
    description: "List the saved version snapshots for a canvas.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    async handler(args) {
      return await listVersions(String(args.id));
    },
  },
  {
    name: "canvas_restore",
    description: "Restore a canvas to a previous version. Snapshots the current state first, so this is itself reversible.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        version: { type: "string", description: "Version timestamp from canvas_versions." },
      },
      required: ["id", "version"],
    },
    async handler(args) {
      return await restoreVersion(String(args.id), String(args.version));
    },
  },
  {
    name: "theme_list",
    description: "List available CSS themes the user has installed.",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      return await listThemes();
    },
  },
  {
    name: "canvas_export",
    description:
      "Export a canvas as markdown or a standalone HTML file. " +
      "Markdown wraps html/css/js in fenced code blocks with a YAML frontmatter. " +
      "Standalone HTML inlines the active theme so the file renders correctly opened from disk. " +
      "For PDF: open the canvas's localhost URL with /print appended in a browser; the print dialog opens automatically.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        format: { type: "string", enum: ["markdown", "html"], description: "markdown | html" },
      },
      required: ["id", "format"],
    },
    async handler(args) {
      const id = String(args.id);
      const format = String(args.format);
      const canvas = await getCanvas(id);
      if (!canvas) throw new Error(`canvas not found: ${id}`);
      if (format === "markdown") {
        return { id, format, content: toMarkdown(canvas) };
      }
      if (format === "html") {
        return { id, format, content: await toStandaloneHtml(canvas) };
      }
      throw new Error(`unsupported format: ${format}`);
    },
  },
  {
    name: "canvas_open_url",
    description: "Get the localhost URL for viewing a canvas in the browser.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    async handler(args) {
      const cfg = await loadConfig();
      return { url: `http://localhost:${cfg.port}/c/${args.id}` };
    },
  },
];

function asContentResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function startMcpServer(): Promise<void> {
  await ensureLayout();

  const server = new Server(
    { name: "universal-canvas", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find(t => t.name === req.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `unknown tool: ${req.params.name}` }],
      };
    }
    try {
      const result = await tool.handler((req.params.arguments ?? {}) as Record<string, unknown>);
      return asContentResult(result);
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: (e as Error).message }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
