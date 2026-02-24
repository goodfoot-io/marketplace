import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/frontmatter.js";

describe("parseFrontmatter", () => {
	it("parses valid frontmatter with name and description", () => {
		const content = `---
name: my-skill
description: A test skill
---
This is the body.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			name: "my-skill",
			description: "A test skill",
		});
		expect(result.body).toBe("This is the body.");
	});

	it("returns empty frontmatter when no --- markers", () => {
		const content = "Just a plain body with no frontmatter.";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just a plain body with no frontmatter.");
	});

	it("handles empty body after frontmatter", () => {
		const content = `---
name: my-skill
---
`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ name: "my-skill" });
		expect(result.body).toBe("");
	});

	it("handles frontmatter-only content (no body)", () => {
		const content = `---
name: my-skill
---`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ name: "my-skill" });
		expect(result.body).toBe("");
	});

	it("preserves body content after frontmatter including leading newlines", () => {
		const content = `---
name: my-skill
---

First line after blank.
Second line.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ name: "my-skill" });
		expect(result.body).toBe("\nFirst line after blank.\nSecond line.");
	});

	it("handles values containing colons", () => {
		const content = `---
description: Contains: colons
---
Body here.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			description: "Contains: colons",
		});
		expect(result.body).toBe("Body here.");
	});

	it("handles quoted string values", () => {
		const content = `---
name: "quoted name"
description: 'single quoted'
---
Body.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			name: "quoted name",
			description: "single quoted",
		});
		expect(result.body).toBe("Body.");
	});

	it("handles multiline values using pipe (|) block scalar", () => {
		const content = `---
name: my-skill
description: |
  Line one.
  Line two.
---
Body.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			name: "my-skill",
			description: "Line one.\nLine two.\n",
		});
		expect(result.body).toBe("Body.");
	});

	it("handles multiline values using fold (>) block scalar", () => {
		const content = `---
name: my-skill
description: >
  Line one.
  Line two.
---
Body.`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			name: "my-skill",
			description: "Line one. Line two.\n",
		});
		expect(result.body).toBe("Body.");
	});

	it("ignores unsupported YAML features gracefully (arrays, nested objects treated as raw strings)", () => {
		const content = `---
name: my-skill
tags:
  - tag1
  - tag2
nested:
  key: value
---
Body.`;
		const result = parseFrontmatter(content);
		// name is parsed, but arrays/nested structures are treated as raw strings or ignored
		expect(result.frontmatter.name).toBe("my-skill");
		// body is still extracted correctly
		expect(result.body).toBe("Body.");
	});
});
