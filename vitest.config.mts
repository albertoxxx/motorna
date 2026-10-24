import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://motorna:motorna_dev@localhost:5432/motorna_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "./storage/test-uploads",
      STORAGE_PRIVATE_DIR: "./storage/test-private",
    },
    fileParallelism: false,
  },
});
