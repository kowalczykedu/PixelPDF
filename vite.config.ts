import { defineConfig } from "vite";

// Local development/build uses "/".
// GitHub Pages project sites use "/<repository-name>/".
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.GITHUB_ACTIONS === "true" && repositoryName
  ? `/${repositoryName}/`
  : "/";

export default defineConfig({
  base,
  server: {
    port: 5173
  }
});
