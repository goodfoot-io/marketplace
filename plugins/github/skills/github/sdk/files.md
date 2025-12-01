# Files

> [Back to SKILL.md](../SKILL.md) | [Issues](issues.md) | [Pull Requests](pull-requests.md) | [Git](git.md) | [Search](search.md) | [Actions](actions.md)

> **Official docs**: https://docs.github.com/en/rest/repos/contents

## Quick Reference

| Operation | Method | Anchor |
|-----------|--------|--------|
| Read file | `repos.getContent()` | #read |
| Create file | `repos.createOrUpdateFileContents()` | #create |
| Update file | `repos.createOrUpdateFileContents()` | #update |
| Delete file | `repos.deleteFile()` | #delete |
| List directory | `repos.getContent()` | #list |

---

## Critical: Base64 Encoding

**File content is always base64 encoded in the GitHub API.**

### Reading Files - Always Decode

```typescript
const decoded = Buffer.from(data.content, "base64").toString("utf8");
```

### Writing Files - Always Encode

```typescript
const encoded = Buffer.from(content).toString("base64");
```

---

## Read File {#read}

```typescript
const { data } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "src/index.ts",
  ref: "main",           // Optional: branch, tag, or commit SHA
});

// Type guard: getContent returns different types for files vs directories
if ("content" in data && !Array.isArray(data)) {
  // This is a file
  const content = Buffer.from(data.content, "base64").toString("utf8");
  console.log("File content:");
  console.log(content);
  console.log("SHA:", data.sha);         // Need this for updates
  console.log("Size:", data.size);
} else {
  console.log("Path is a directory, not a file");
}
```

### Response Fields (File)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | File name |
| `path` | string | Full path |
| `sha` | string | File SHA (needed for updates) |
| `size` | number | File size in bytes |
| `content` | string | Base64-encoded content |
| `encoding` | string | Always "base64" |
| `html_url` | string | GitHub web URL |
| `download_url` | string | Raw file URL |

### Read from Specific Branch/Commit

```typescript
// From branch
const { data } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "README.md",
  ref: "feature-branch",
});

// From specific commit
const { data: fromCommit } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "README.md",
  ref: "abc1234",  // Commit SHA
});
```

---

## Create File {#create}

```typescript
const content = "# New File\n\nThis is a new file.";

const { data } = await octokit.rest.repos.createOrUpdateFileContents({
  owner: "owner",
  repo: "repo",
  path: "docs/newfile.md",
  message: "Add newfile.md",
  content: Buffer.from(content).toString("base64"),
  branch: "main",           // Optional: defaults to default branch
  committer: {              // Optional
    name: "Bot",
    email: "bot@example.com",
  },
  author: {                 // Optional
    name: "Author Name",
    email: "author@example.com",
  },
});

console.log("File created");
console.log("Commit SHA:", data.commit.sha);
console.log("File SHA:", data.content?.sha);
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | Yes | Repository owner |
| `repo` | string | Yes | Repository name |
| `path` | string | Yes | File path |
| `message` | string | Yes | Commit message |
| `content` | string | Yes | Base64-encoded content |
| `branch` | string | No | Branch name |
| `sha` | string | For updates | Current file SHA |
| `committer` | object | No | Committer info |
| `author` | object | No | Author info |

---

## Update File {#update}

**Important**: Updates require the current file's SHA. Get it from `getContent()` first.

```typescript
// Step 1: Get current file to obtain SHA
const { data: currentFile } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "README.md",
});

if (!("sha" in currentFile) || Array.isArray(currentFile)) {
  throw new Error("Expected a file, not a directory");
}

// Step 2: Update with the SHA
const newContent = "# Updated README\n\nNew content here.";

const { data } = await octokit.rest.repos.createOrUpdateFileContents({
  owner: "owner",
  repo: "repo",
  path: "README.md",
  message: "Update README",
  content: Buffer.from(newContent).toString("base64"),
  sha: currentFile.sha,    // Required for updates!
});

console.log("File updated");
console.log("New commit:", data.commit.sha);
```

### Error: 409 Conflict

If you get a 409 error, the SHA is stale (file was modified since you read it):

```typescript
try {
  await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path, message, content, sha,
  });
} catch (error: any) {
  if (error.status === 409) {
    console.log("File was modified. Re-read and try again.");
    // Re-fetch the file to get new SHA, then retry
  }
}
```

---

## Delete File {#delete}

```typescript
// First get the file to obtain its SHA
const { data: file } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "path/to/file.txt",
});

if (!("sha" in file) || Array.isArray(file)) {
  throw new Error("Expected a file");
}

// Delete the file
await octokit.rest.repos.deleteFile({
  owner: "owner",
  repo: "repo",
  path: "path/to/file.txt",
  message: "Delete file.txt",
  sha: file.sha,
  branch: "main",  // Optional
});

console.log("File deleted");
```

---

## List Directory {#list}

```typescript
const { data } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "src",              // Directory path, or "" for root
  ref: "main",              // Optional
});

if (Array.isArray(data)) {
  // This is a directory listing
  for (const item of data) {
    const type = item.type === "dir" ? "[DIR]" : "[FILE]";
    console.log(type, item.name);
    console.log("  Path:", item.path);
    console.log("  SHA:", item.sha);
    if (item.type === "file") {
      console.log("  Size:", item.size);
    }
  }
} else {
  console.log("Path is a file, not a directory");
}
```

### Response Fields (Directory Item)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | File/directory name |
| `path` | string | Full path |
| `sha` | string | SHA |
| `size` | number | Size (files only) |
| `type` | string | "file", "dir", or "symlink" |
| `html_url` | string | GitHub web URL |
| `download_url` | string | Raw URL (files only) |

### List Root Directory

```typescript
const { data } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "",  // Empty string for root
});
```

---

## Working with Binary Files

For binary files (images, PDFs, etc.), handle the encoding properly:

### Read Binary File

```typescript
const { data } = await octokit.rest.repos.getContent({
  owner: "owner",
  repo: "repo",
  path: "images/logo.png",
});

if ("content" in data && !Array.isArray(data)) {
  // Save to file
  const buffer = Buffer.from(data.content, "base64");
  // buffer contains the raw binary data
}
```

### Upload Binary File

```typescript
import * as fs from "fs";

// Read local file as base64
const fileBuffer = fs.readFileSync("local-image.png");
const base64Content = fileBuffer.toString("base64");

await octokit.rest.repos.createOrUpdateFileContents({
  owner: "owner",
  repo: "repo",
  path: "images/uploaded.png",
  message: "Add image",
  content: base64Content,
});
```

---

## Complete Example: Update Config File

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = "owner";
const repo = "repo";
const path = "config.json";

// 1. Read current file
const { data: current } = await octokit.rest.repos.getContent({
  owner,
  repo,
  path,
});

if (Array.isArray(current) || !("content" in current)) {
  throw new Error("Expected a file");
}

// 2. Parse current content
const currentContent = Buffer.from(current.content, "base64").toString("utf8");
const config = JSON.parse(currentContent);

// 3. Modify config
config.version = "2.0.0";
config.updatedAt = new Date().toISOString();

// 4. Update file
const newContent = JSON.stringify(config, null, 2);

await octokit.rest.repos.createOrUpdateFileContents({
  owner,
  repo,
  path,
  message: "Bump version to 2.0.0",
  content: Buffer.from(newContent).toString("base64"),
  sha: current.sha,
});

console.log("Config updated successfully");
```

---

## Create File on New Branch

To create a file as part of a PR, first create a branch (see sdk/git.md), then create the file on that branch:

```typescript
// Assumes branch already exists (see sdk/git.md#create-branch)
await octokit.rest.repos.createOrUpdateFileContents({
  owner: "owner",
  repo: "repo",
  path: "new-file.md",
  message: "Add new file",
  content: Buffer.from("# Content").toString("base64"),
  branch: "feature-branch",  // Specify the branch
});
```
