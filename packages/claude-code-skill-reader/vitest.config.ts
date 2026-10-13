import {
	loadCacheContract,
	withTestOutput,
} from "@goodfoot/vitest-cache/policy";
import { defineConfig } from "vitest/config";

export default withTestOutput(
	defineConfig({
		test: {
			globals: false,
			include: ["test/**/*.test.ts"],
			exclude: ["test/fixtures/**"],
		},
	}),
	loadCacheContract(new URL("./vitest.cache.json", import.meta.url)),
);
