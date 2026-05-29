import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,

  name: "TVPL Crawler",

  version: "1.0.0",

  permissions: ["storage", "tabs", "downloads", "scripting"],

  host_permissions: ["https://thuvienphapluat.vn/*", "http://localhost:8909/*", "http://127.0.0.1:8909/*"],

  action: {
    default_popup: "index.html",
  },

  options_ui: {
    page: "options.html",
    open_in_tab: true,
  },

  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: ["https://thuvienphapluat.vn/*"],
      js: ["src/content/scraper.ts"],
    },
  ],
};

export default manifest;