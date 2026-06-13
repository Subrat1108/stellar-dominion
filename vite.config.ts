import { defineConfig } from "vite";

// Web-first build (see docs/03). The sim core under src/sim stays free of any
// DOM/Three import so it can run headless in Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
