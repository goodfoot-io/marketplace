import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		include: ["test/**/*.test.ts"],
		exclude: ["test/fixtures/**"],
		// Language-service tests (type-declarations*.test.ts) build a full
		// TypeScript program per test; under concurrent load on a shared
		// devcontainer a cold start has been observed at ~7s. The default
		// 5000ms is too tight — hang detection is unaffected, since this is
		// only an outer safety net over the tests' own assertions.
		testTimeout: 15000,
	},
});
