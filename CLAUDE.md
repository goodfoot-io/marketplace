<workspace_information>
This workspace uses Yarn 4.9.2 as a package manager. Do not use other package managers such as 'npm'.

This a monorepo workspace with all packages in ./packages/
</workspace_information>

<error-handling>
If you are instructed to use a program and encounter an unexpected error, you must alert the user.
</error-handling>

<webfetch>
Prepend `https://r.jina.ai/` to the original URL (i.e. `https://r.jina.ai/${ORIGINAL_URL}`) when using the `WebFetch` tool or `curl`.

Example:
```bash
curl "https://r.jina.ai/https://www.example.com/path/to/content.html"
```
</webfetch>
