import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: ".output",
  manifest: {
    name: "Supacanvas",
    description: "Quick-launch your AI-generated canvases from any tab.",
    permissions: [
      "sidePanel",
      "contextMenus",
      "notifications",
      "activeTab",
      "scripting",
      "storage",
    ],
    host_permissions: ["http://localhost:7777/*"],
    action: {
      default_title: "Supacanvas",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    icons: {
      16: "icon/16.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
});
