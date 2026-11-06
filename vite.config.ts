import { defineConfig } from "vite";

// Relative base "./" works universally on localhost, custom domains, and GitHub Pages project sites (/repo-name/).
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.GITHUB_ACTIONS === "true" && repositoryName
    ? `/${repositoryName}/`
    : "./";

export default defineConfig({
  base,
  worker: {
    format: "es"
  },
  server: {
    port: 5173
  }
});
