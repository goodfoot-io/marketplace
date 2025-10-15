# React Router Static Site Generation (SSG)

**Comprehensive Guide to Static Builds Without Node.js Server**

Last Updated: 2025-01-10
React Router Version: v7+

---

## Table of Contents

1. [Overview](#overview)
2. [Framework vs Library Mode](#framework-vs-library-mode)
3. [Static Generation Methods](#static-generation-methods)
4. [Configuration Reference](#configuration-reference)
5. [Build Process](#build-process)
6. [Data Loading Strategies](#data-loading-strategies)
7. [Deployment](#deployment)
8. [Limitations and Constraints](#limitations-and-constraints)
9. [Examples](#examples)
10. [Performance and SEO Benefits](#performance-and-seo-benefits)
11. [Platform-Specific Guides](#platform-specific-guides)

---

## Overview

React Router v7 introduced **Framework Mode**, which provides powerful static site generation capabilities that don't require a Node.js server at runtime. This allows you to deploy React applications to any static hosting platform (Netlify, Vercel, GitHub Pages, S3, etc.) while maintaining modern routing features.

### Key Capabilities

- **Full Static Export**: Generate static HTML files at build time
- **SPA Mode**: Single Page Application with pre-rendered shell
- **Selective Pre-rendering**: Mix static and dynamic content
- **SEO Optimization**: Pre-rendered HTML for search engines
- **No Server Required**: Deploy to any CDN or static host

---

## Framework vs Library Mode

React Router v7 supports **three distinct modes**, each with increasing complexity and features:

### 1. Declarative Mode (Library)
- **Use Case**: Traditional client-side routing only
- **Features**: Basic URL matching and navigation
- **Best For**: Simple SPAs, coming from React Router v6
- **Limitations**: No SSR, no static generation, no data loaders

### 2. Data Mode (Library)
- **Use Case**: Client-side routing with data loading
- **Features**: Data loaders, actions, pending states
- **Best For**: Complex SPAs with client-side data management
- **Limitations**: No SSR, limited static generation

### 3. Framework Mode ⭐ (Required for SSG)
- **Use Case**: Full-featured applications with SSR/SSG
- **Features**: All of the above PLUS:
  - Type-safe routing
  - Intelligent code splitting
  - Multiple rendering strategies (SPA, SSR, Static)
  - Build-time pre-rendering
  - Server-side rendering capabilities
- **Best For**: Static sites, SEO-critical apps, modern web applications
- **Setup**: Requires React Router CLI and Vite plugin

**IMPORTANT**: Static site generation features are **only available in Framework Mode**.

---

## Static Generation Methods

React Router offers two primary approaches for generating static builds:

### Method 1: SPA Mode (ssr: false)

**Single HTML file serves all routes** - traditional SPA with enhanced initial render.

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,              // Disable runtime server rendering
  // Optional: prerender specific routes
  prerender: ["/", "/about", "/contact"]
} satisfies Config;
```

**How It Works**:
1. React Router generates a robust `index.html` at build time
2. Root route is pre-rendered (can include a `loader`)
3. All navigation happens client-side
4. Other routes cannot have `loader` unless pre-rendered
5. Use `clientLoader` and `clientAction` for data management

**Output**:
- `build/client/index.html` - Main SPA entry point
- `build/client/__spa-fallback.html` - Fallback for non-pre-rendered routes (if `/` is pre-rendered)
- Static assets (JS, CSS, images)

**Deployment**: Deploy `build/client` folder, configure server to redirect all routes to `index.html`

---

### Method 2: Pre-rendering (ssr: false + prerender)

**Generate static HTML for specific routes** - best of both worlds.

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,              // No runtime server
  prerender: true,         // Pre-render all static routes
} satisfies Config;
```

**Pre-rendering Options**:

```typescript
// Option 1: All static routes (no dynamic segments)
export default {
  ssr: false,
  prerender: true,
} satisfies Config;

// Option 2: Specific paths
export default {
  ssr: false,
  prerender: ["/", "/blog", "/about", "/contact"],
} satisfies Config;

// Option 3: Dynamic generation (from CMS, database, etc.)
export default {
  ssr: false,
  async prerender() {
    // Fetch from any data source
    const posts = await fetch("https://api.example.com/posts").then(r => r.json());
    const products = await getProductsFromDatabase();

    return [
      "/",
      "/blog",
      ...posts.map((post) => `/blog/${post.slug}`),
      ...products.map((p) => `/products/${p.id}`),
    ];
  },
} satisfies Config;
```

**Output** (for each pre-rendered route):
- `build/client/[route]/index.html` - Static HTML
- `build/client/[route].data` - Client navigation data payload

**How Route Loaders Work**:
- During build, React Router creates a `new Request()` for each URL
- Route `loader` functions execute at build time
- Data is baked into static HTML and `.data` files
- Client navigation uses `.data` files for instant transitions

---

## Configuration Reference

### Complete Config Options

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  // Rendering Mode
  ssr: false,              // true = SSR, false = SPA/Static only

  // Pre-rendering Configuration
  prerender: true,         // boolean, array, or async function

  // Build Output (optional)
  buildDirectory: "build", // Default: "build"

  // Other framework options...
  // (basename, future flags, etc.)
} satisfies Config;
```

### SSR Flag Behavior

| ssr Value | Behavior |
|-----------|----------|
| `true` (default) | Generates server build + client build. Requires Node.js runtime |
| `false` | Client-only build. Root route pre-rendered to `index.html`. No server bundle |

### Prerender Flag Behavior

| prerender Value | Behavior |
|-----------------|----------|
| `undefined` | No pre-rendering (pure runtime rendering) |
| `true` | Pre-render all routes with static paths (no dynamic segments) |
| `["/", "/about"]` | Pre-render specific paths |
| `async () => [...]` | Dynamic path generation at build time |

---

## Build Process

### Installation

```bash
# Create new project
npx create-react-router@latest my-app

# Or use template
npx create-react-router@latest --template remix-run/react-router-templates/spa
```

### Build Command

```bash
# Development
npx react-router dev

# Production build
npx react-router build
```

### Build Output Structure

```
build/
├── client/                    # Deploy this folder to static host
│   ├── index.html            # Pre-rendered root route (SPA entry)
│   ├── __spa-fallback.html   # SPA fallback (if "/" is pre-rendered)
│   ├── about/
│   │   └── index.html        # Pre-rendered /about
│   ├── about.data            # Client navigation data for /about
│   ├── assets/               # JS, CSS, images
│   │   ├── entry.client-[hash].js
│   │   ├── root-[hash].js
│   │   └── styles-[hash].css
│   └── ...
└── server/                    # NOT generated when ssr: false
    └── index.js              # (Only exists with ssr: true)
```

**What to Deploy**: The entire `build/client` directory

---

## Data Loading Strategies

### Loader vs ClientLoader

React Router provides multiple data loading strategies for static sites:

#### 1. Server Loader (Build-time only with ssr: false)

```typescript
// app/routes/products.tsx
import type { Route } from "./+types/products";

// Runs at BUILD TIME when pre-rendering
export async function loader({ request }: Route.LoaderArgs) {
  const products = await fetch("https://api.example.com/products");
  return products.json();
}

export default function Products({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      {loaderData.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

**When to Use**:
- Route is pre-rendered
- Data is static or updated via rebuild
- SEO is important

**Constraints with ssr: false**:
- Only works on routes listed in `prerender` config
- Data is fetched once at build time
- No dynamic revalidation (unless using `clientLoader`)

---

#### 2. Client Loader (Runtime in browser)

```typescript
// app/routes/dashboard.tsx
import type { Route } from "./+types/dashboard";

// Runs in BROWSER on navigation
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const token = localStorage.getItem("auth-token");
  const data = await fetch("/api/dashboard", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.json();
}

// Show loading state during fetch
export function HydrateFallback() {
  return <div>Loading dashboard...</div>;
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return <div>{/* Use loaderData */}</div>;
}
```

**When to Use**:
- Data requires browser APIs (localStorage, cookies)
- Authentication required
- Real-time or user-specific data
- Route is NOT pre-rendered (SPA mode)

---

#### 3. Hybrid: loader + clientLoader

```typescript
// app/routes/blog.$.tsx
import type { Route } from "./+types/blog.$";

// Runs at BUILD TIME during pre-rendering
export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPostFromCMS(params["*"]);
  return { post, cached: false };
}

// Runs in BROWSER on client navigation
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // Check cache first
  const cached = getCachedPost(params["*"]);
  if (cached) return { post: cached, cached: true };

  // Fetch fresh data
  const post = await fetch(`/api/posts/${params["*"]}`).then(r => r.json());
  setCachedPost(params["*"], post);
  return { post, cached: false };
}

// Tell React Router to call loader during SSR/pre-rendering
clientLoader.hydrate = true;

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <div>{loaderData.post.content}</div>
      {loaderData.cached && <small>Cached version</small>}
    </article>
  );
}
```

**When to Use**:
- Pre-rendered for SEO, but need fresh data on client navigation
- Implementing client-side caching
- Combining static + dynamic data sources

---

#### 4. Client Actions (Mutations)

```typescript
// app/routes/contact.tsx
import type { Route } from "./+types/contact";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();

  const response = await fetch("/api/contact", {
    method: "POST",
    body: JSON.stringify({
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    }),
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    return { error: "Failed to send message" };
  }

  return { success: true };
}

export default function Contact({ actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      {actionData?.success && <p>Message sent!</p>}
      {actionData?.error && <p>{actionData.error}</p>}

      <input name="name" required />
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button type="submit">Send</button>
    </Form>
  );
}
```

**When to Use**:
- Form submissions
- API mutations
- Any POST/PUT/DELETE operations
- Works seamlessly in static sites

---

### Data Loading Rules with ssr: false

| Route State | Loader Allowed? | ClientLoader Allowed? |
|-------------|----------------|---------------------|
| Root route (/) | ✅ Yes | ✅ Yes |
| Pre-rendered route | ✅ Yes | ✅ Yes |
| Non-pre-rendered route | ❌ No | ✅ Yes |
| Any route | N/A | ✅ Always |

---

## Deployment

### General Static Hosting

After building, deploy the `build/client` directory to any static host. **Critical**: Configure the server to redirect all routes to `index.html` for client-side routing to work.

### Redirect Configuration

#### Netlify (_redirects file)

Place in `public/_redirects` (copied to build during build):

```
/*    /index.html   200
```

#### Netlify (netlify.toml)

```toml
[build]
  command = "react-router build"
  publish = "build/client"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel (vercel.json)

```json
{
  "buildCommand": "react-router build",
  "outputDirectory": "build/client",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### GitHub Pages Workaround

GitHub Pages doesn't support server-side redirects. Solutions:

**Option 1: Use HashRouter** (Not recommended for SSG)
```typescript
// Switch to hash-based routing (#/about instead of /about)
// Defeats purpose of static generation
```

**Option 2: 404.html Trick**
```bash
# Copy index.html to 404.html in build
cp build/client/index.html build/client/404.html
```

GitHub Pages serves 404.html for missing routes, which contains your React app.

**Option 3: Configure homepage in package.json**
```json
{
  "homepage": "https://username.github.io/repo-name"
}
```

#### AWS S3 + CloudFront

S3 Static Website Hosting:
- Error Document: `index.html`
- Index Document: `index.html`

CloudFront:
- Create custom error response: 404 → `/index.html` (200)

#### Generic Apache (.htaccess)

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Generic Nginx

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## Limitations and Constraints

### SPA Mode (ssr: false) Limitations

1. **Loader Restrictions**:
   - ✅ Root route (`/`) can have a `loader`
   - ❌ Other routes cannot have `loader` unless pre-rendered
   - ✅ All routes can use `clientLoader`

2. **No Server Functions**:
   - ❌ Cannot use `action` on any route (use `clientAction`)
   - ❌ Cannot use `headers` function
   - ❌ No runtime server rendering

3. **Static Data Only**:
   - Loader data is baked into build
   - No dynamic revalidation without rebuilding
   - Use `clientLoader` for dynamic data

4. **Parent Route Loaders**:
   - If parent route is pre-rendered and has children, you must:
     - Pre-render all child routes, OR
     - Ensure parent `loaderData` can be determined at runtime

### Pre-rendering Constraints

1. **Build-time Execution**:
   - Loaders run in Node.js environment during build
   - Cannot access browser APIs (localStorage, cookies, window)
   - Must be "SSR-safe" (avoid browser-only code)

2. **Dynamic Routes**:
   - Must enumerate all paths in `prerender` function
   - Cannot pre-render infinite routes
   - Example: Can pre-render `/blog/post-1`, `/blog/post-2`, but not `/blog/:slug` without listing all slugs

3. **Data Staleness**:
   - Pre-rendered data is static until next build
   - Use `clientLoader` to fetch fresh data after hydration
   - Rebuilds required to update static content

4. **Hybrid Applications**:
   - Mixing pre-rendered + SPA routes requires careful planning
   - Avoid `.data` requests for non-pre-rendered paths (will 404)

---

## Examples

### Example 1: Simple Static Site

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  prerender: ["/", "/about", "/contact", "/blog"],
} satisfies Config;
```

```typescript
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("blog", "routes/blog.tsx"),
] satisfies RouteConfig;
```

```typescript
// app/routes/home.tsx
export default function Home() {
  return (
    <div>
      <h1>Welcome to My Static Site</h1>
      <nav>
        <Link to="/about">About</Link>
        <Link to="/blog">Blog</Link>
      </nav>
    </div>
  );
}
```

**Build**: `npx react-router build`
**Deploy**: Upload `build/client` to any static host
**Result**: 4 HTML files + assets, no server required

---

### Example 2: Blog with Dynamic Posts

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import fs from "fs/promises";
import path from "path";

export default {
  ssr: false,
  async prerender() {
    // Read blog posts from file system
    const postsDir = path.join(process.cwd(), "content/posts");
    const files = await fs.readdir(postsDir);
    const slugs = files.map(f => f.replace(".md", ""));

    return [
      "/",
      "/blog",
      ...slugs.map(slug => `/blog/${slug}`),
    ];
  },
} satisfies Config;
```

```typescript
// app/routes/blog.$.tsx
import type { Route } from "./+types/blog.$";
import { parseMarkdown } from "~/lib/markdown";
import fs from "fs/promises";

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params["*"];
  const content = await fs.readFile(`content/posts/${slug}.md`, "utf-8");
  const post = parseMarkdown(content);

  return { post };
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <time>{loaderData.post.date}</time>
      <div dangerouslySetInnerHTML={{ __html: loaderData.post.html }} />
    </article>
  );
}
```

---

### Example 3: E-commerce Product Pages (CMS)

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  async prerender() {
    // Fetch from headless CMS
    const response = await fetch("https://api.myshop.com/products");
    const products = await response.json();

    return [
      "/",
      "/products",
      ...products.map(p => `/products/${p.slug}`),
      "/cart",    // SPA route (not pre-rendered)
      "/checkout", // SPA route
    ];
  },
} satisfies Config;
```

```typescript
// app/routes/products.$slug.tsx
import type { Route } from "./+types/products.$slug";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await fetch(
    `https://api.myshop.com/products/${params.slug}`
  ).then(r => r.json());

  return { product };
}

export default function Product({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>{loaderData.product.name}</h1>
      <img src={loaderData.product.image} alt={loaderData.product.name} />
      <p>{loaderData.product.description}</p>
      <p>${loaderData.product.price}</p>

      {/* Client-side cart logic */}
      <AddToCartButton productId={loaderData.product.id} />
    </div>
  );
}
```

```typescript
// app/routes/cart.tsx
import type { Route } from "./+types/cart";

// Cart is NOT pre-rendered - uses clientLoader
export async function clientLoader() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  return { cart };
}

export default function Cart({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Your Cart</h1>
      {loaderData.cart.map(item => (
        <CartItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

---

### Example 4: Documentation Site with MDX

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
import { init } from "react-router-mdx/server";

const mdx = init({ path: "docs" });

export default {
  ssr: false,
  async prerender() {
    return [
      "/",
      ...(await mdx.paths()),
    ];
  },
} satisfies Config;
```

```typescript
// app/routes.ts
import { index } from "@react-router/dev/routes";
import { routes as mdxRoutes } from "react-router-mdx/server";

export default [
  index("routes/home.tsx"),
  ...mdxRoutes("routes/docs.tsx"),
];
```

```typescript
// app/routes/docs.tsx
import { loadMdx } from "react-router-mdx/server";
import { useMdxComponent } from "react-router-mdx/client";

export const loader = async ({ request }) => {
  return loadMdx(request);
};

export default function Docs() {
  const Component = useMdxComponent();
  return (
    <div className="docs">
      <Component />
    </div>
  );
}
```

Create MDX files in `docs/` directory:

```markdown
---
title: Getting Started
---

# Getting Started

Welcome to the documentation!
```

---

### Example 5: Hybrid SPA + Pre-rendered

```typescript
// react-router.config.ts
export default {
  ssr: false,
  prerender: [
    "/",
    "/about",
    "/blog",
    "/docs",
    // /dashboard and /admin are SPA-only (not pre-rendered)
  ],
} satisfies Config;
```

```typescript
// app/routes/dashboard.tsx
// NOT pre-rendered - purely client-side

import type { Route } from "./+types/dashboard";

export async function clientLoader() {
  // Fetch user-specific data
  const user = await getCurrentUser();
  const stats = await fetchUserStats(user.id);
  return { user, stats };
}

export function HydrateFallback() {
  return <div>Loading dashboard...</div>;
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Welcome, {loaderData.user.name}</h1>
      {/* User-specific content */}
    </div>
  );
}
```

**Result**:
- `/`, `/about`, `/blog`, `/docs` have static HTML (SEO-friendly)
- `/dashboard`, `/admin` load via client-side routing (private data)
- Best of both worlds: public content is pre-rendered, private content is dynamic

---

## Performance and SEO Benefits

### Performance Advantages

1. **Instant Initial Load**:
   - Pre-rendered HTML loads immediately
   - No waiting for JavaScript to render
   - Faster First Contentful Paint (FCP)

2. **CDN Distribution**:
   - Static files cached at edge locations
   - Lower latency worldwide
   - Reduced server costs (no compute, just storage)

3. **Code Splitting**:
   - React Router automatically splits code per route
   - Only load JavaScript needed for current page
   - Faster Time to Interactive (TTI)

4. **Client-side Navigation**:
   - After hydration, navigation is instant
   - Pre-fetches `.data` files on link hover
   - No full page reloads

### SEO Advantages

1. **Crawlable HTML**:
   - Search engines see fully rendered HTML
   - No JavaScript execution required for indexing
   - Better ranking potential

2. **Meta Tags**:
   - Pre-rendered pages include dynamic meta tags
   - Proper Open Graph tags for social sharing
   - Structured data for rich snippets

3. **Performance Metrics**:
   - Better Core Web Vitals (LCP, FID, CLS)
   - Google uses page speed as ranking factor
   - Pre-rendering improves all metrics

### Comparison: SPA vs Pre-rendered vs SSR

| Metric | Traditional SPA | Pre-rendered | SSR |
|--------|----------------|--------------|-----|
| Initial HTML | Empty shell | Full content | Full content |
| SEO | Poor | Excellent | Excellent |
| Build Time | Fast | Medium | Fast |
| Runtime Cost | Free (CDN) | Free (CDN) | $$ (servers) |
| Data Freshness | Stale until rebuild | Stale until rebuild | Always fresh |
| Complexity | Low | Medium | High |

**Pre-rendering sweet spot**: SEO-critical content that doesn't change frequently (blogs, docs, marketing pages, product catalogs).

---

## Platform-Specific Guides

### Netlify

**1. Install Netlify Plugin**:

```bash
npm install @netlify/vite-plugin-react-router
```

**2. Update Vite Config**:

```typescript
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import netlifyPlugin from "@netlify/vite-plugin-react-router";

export default defineConfig({
  plugins: [
    reactRouter(),
    netlifyPlugin(),
  ],
});
```

**3. Create netlify.toml**:

```toml
[build]
  command = "react-router build"
  publish = "build/client"

[dev]
  command = "react-router dev"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**4. Deploy**:

```bash
# CLI
netlify deploy --build --prod

# Or connect Git repo in Netlify dashboard
```

---

### Vercel

**1. Install Vercel Template**:

```bash
npx create-react-router@latest --template vercel
```

Or manually create `vercel.json`:

```json
{
  "buildCommand": "react-router build",
  "outputDirectory": "build/client",
  "devCommand": "react-router dev",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**2. Deploy**:

```bash
vercel deploy --prod
```

---

### GitHub Pages

**1. Build Script**:

```json
// package.json
{
  "homepage": "https://username.github.io/repo-name",
  "scripts": {
    "build": "react-router build && cp build/client/index.html build/client/404.html"
  }
}
```

**2. GitHub Actions Workflow**:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build/client
```

**3. Repository Settings**:
- Settings → Pages → Source: `gh-pages` branch

---

### Cloudflare Pages

**1. Create Project** in Cloudflare dashboard

**2. Configure Build**:
- Build command: `react-router build`
- Build output directory: `build/client`

**3. Add _redirects** (optional):

```
/*    /index.html   200
```

**4. Deploy** via Git integration or CLI:

```bash
npx wrangler pages deploy build/client
```

---

### AWS S3 + CloudFront

**1. Build**:

```bash
npm run build
```

**2. Create S3 Bucket**:
- Enable static website hosting
- Index document: `index.html`
- Error document: `index.html`

**3. Upload**:

```bash
aws s3 sync build/client s3://your-bucket-name --delete
```

**4. Create CloudFront Distribution**:
- Origin: S3 bucket
- Custom error response: 404 → `/index.html` (200)

**5. Invalidate Cache** on updates:

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

### Docker (for flexibility)

Even though you don't need a server, Docker can be useful for local testing:

```dockerfile
# Dockerfile
FROM nginx:alpine

COPY build/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

```nginx
# nginx.conf
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

```bash
docker build -t my-react-router-app .
docker run -p 8080:80 my-react-router-app
```

---

## Additional Resources

### Official Documentation
- [React Router v7 Docs](https://reactrouter.com/)
- [Pre-Rendering Guide](https://reactrouter.com/how-to/pre-rendering)
- [SPA Mode Guide](https://reactrouter.com/how-to/spa)
- [Rendering Strategies](https://reactrouter.com/start/framework/rendering)
- [Data Loading](https://reactrouter.com/start/framework/data-loading)

### Community Resources
- [React Router on GitHub](https://github.com/remix-run/react-router)
- [React Router Discord](https://rmx.as/discord)

### Tutorials
- [How to Build a Static Site with React Router v7 + MDX](https://dev.to/mquintal/how-to-built-a-static-site-react-router-v7-mdx-4lc1)
- [React Router V7: A Crash Course](https://dev.to/pedrotech/react-router-v7-a-crash-course-2m86)
- [Server-side Rendering with React Router v7](https://blog.logrocket.com/server-side-rendering-react-router-v7/)

---

## Quick Reference: Decision Tree

```
Do you need static site generation?
│
├─ NO → Use Declarative or Data Mode (Library)
│
└─ YES → Use Framework Mode
    │
    ├─ All routes static?
    │   └─ YES → ssr: false, prerender: true
    │
    ├─ Some routes static, some dynamic?
    │   └─ YES → ssr: false, prerender: [specific paths]
    │
    ├─ Need runtime SSR for some routes?
    │   └─ YES → ssr: true, prerender: [static paths]
    │
    └─ Pure SPA with enhanced initial load?
        └─ YES → ssr: false, prerender: undefined (or ["/"])
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Using loader on non-pre-rendered routes (ssr: false)

**Error**: `Route "X" cannot have a loader when using ssr: false without prerendering`

**Solution**: Either:
- Add route to `prerender` array
- Change `loader` to `clientLoader`

---

### Pitfall 2: Browser APIs in loader

**Error**: `ReferenceError: localStorage is not defined`

**Solution**: Move browser-only code to `clientLoader`:

```typescript
// ❌ Bad
export async function loader() {
  const token = localStorage.getItem("token"); // Crashes during build
  return fetchData(token);
}

// ✅ Good
export async function clientLoader() {
  const token = localStorage.getItem("token");
  return fetchData(token);
}
```

---

### Pitfall 3: Missing redirects on static host

**Error**: 404 on direct navigation to `/about`

**Solution**: Configure server redirects (see Deployment section)

---

### Pitfall 4: Infinite routes

**Error**: Can't enumerate all possible paths for dynamic routes

**Solution**: Use hybrid approach:

```typescript
export default {
  ssr: false,
  prerender: [
    "/",
    // Pre-render popular posts
    "/blog/getting-started",
    "/blog/advanced-guide",
  ],
  // Other posts load via SPA
} satisfies Config;
```

---

### Pitfall 5: Stale pre-rendered data

**Problem**: Product prices outdated on pre-rendered pages

**Solution**: Use `clientLoader` to fetch fresh data:

```typescript
export async function loader({ params }) {
  // Build-time data (for SEO)
  const product = await getProductFromCMS(params.id);
  return { product };
}

export async function clientLoader({ params }) {
  // Runtime data (fresh pricing)
  const product = await fetch(`/api/products/${params.id}`).then(r => r.json());
  return { product };
}

// Use loader for initial SSR, clientLoader for navigation
clientLoader.hydrate = true;
```

---

## Conclusion

React Router v7's static site generation capabilities make it a powerful alternative to traditional static site generators (Gatsby, Next.js SSG, Astro) while maintaining the flexibility of a React framework.

**Key Takeaways**:

1. **Framework Mode is required** for static generation
2. **ssr: false** enables static-only builds (no Node.js server)
3. **prerender** controls which routes get static HTML
4. **clientLoader/clientAction** enable dynamic behavior in static sites
5. **Deploy anywhere** - just upload `build/client` folder
6. **SEO + Performance** - best of both worlds

**Ideal Use Cases**:
- Blogs and content sites
- Documentation sites
- Marketing websites
- E-commerce product pages
- Portfolio sites
- Landing pages

**Not Ideal For**:
- Real-time applications (dashboards, chat)
- Highly personalized content
- Apps requiring server-side auth
- Routes with infinite dynamic segments

For these cases, consider SSR (`ssr: true`) or hybrid approaches.

---

**Last Updated**: 2025-01-10
**React Router Version**: v7.0+
**Compiled by**: Claude Code Research Agent
