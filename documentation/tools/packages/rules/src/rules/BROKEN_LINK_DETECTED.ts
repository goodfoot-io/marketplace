import type { Rule, RuleViolation } from '../types.js';
import { promises as fs } from 'fs';

import { z } from 'zod';
import { LinkScraper } from '../../../scrape/src/index.js';
import { readFile, fileExists, resolveProjectPath } from '../utils/file-utils.js';
import { createViolation } from '../utils/parse-utils.js';
import { iterateStories } from '../utils/story-utils.js';
import { readYamlFile } from '../utils/yaml-utils.js';

// Schema for blackboard validation
const BlackboardSchema = z
  .object({
    project_metadata: z
      .object({
        latest_file: z.string().optional()
      })
      .optional()
  })
  .passthrough(); // Allow additional fields

// Use zod schema instead of interface for type safety

/**
 * BROKEN_LINK_DETECTED Rule
 *
 * Intelligently validates external links in essay files with state-aware caching
 *
 * @description
 * This rule checks all external links in essay.md files for accessibility.
 * It maintains a persistent ledger of link health status and implements
 * intelligent re-checking based on story lifecycle state. Links in active
 * stories are re-checked every 48 hours, while links in published/archived
 * stories are only checked if they're new or previously broken.
 *
 * @rationale
 * From protocols/organization-protocol.md:
 * "Claude understands the Link Status Ledger System for automated link validation:
 * - Uses `link-status-ledger.json` at each story root to track link status
 * - `active/` stories: Links re-checked if last check > 48 hours ago
 * - `published/` and `archive/` stories: No broken link checking performed
 * - `BROKEN_LINK_DETECTED` rule reports failing links not in `link-overrides.yaml`"
 *
 * @enforcement
 * - Extracts all URLs from essay.md files
 * - Checks link status using headless browser
 * - Maintains link-status-ledger.json with results
 * - Applies 48-hour TTL for active stories only
 * - Always re-checks new links and previously broken links
 * - Respects link-overrides.yaml for manual approvals
 *
 * @notFixable
 * Broken links require human intervention to either fix the URL, find an
 * alternative source, or remove the link entirely.
 */

// Schema definitions
const LinkStatusSchema = z.object({
  url: z.string(),
  status: z.enum(['healthy', 'broken', 'redirect']),
  httpStatus: z.number(),
  finalUrl: z.string(),
  lastChecked: z.string(),
  retryCount: z.number().default(0),
  lastError: z.string().optional()
});

const LinkStatusLedgerSchema = z.object({
  version: z.literal('1.0'),
  links: z.record(z.string(), LinkStatusSchema)
});

const LinkOverridesSchema = z.object({
  overrides: z
    .array(
      z.object({
        url: z.string(),
        reason: z.string(),
        authorized_by: z.string(),
        timestamp: z.string()
      })
    )
    .optional()
});

// Extract URLs from markdown content
function extractUrls(content: string): string[] {
  const urls = new Set<string>();

  // Match markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const url = match[2];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      urls.add(url);
    }
  }

  // Match bare URLs (exclude common trailing punctuation)
  const bareUrlRegex = /https?:\/\/[^\s<>"{}|\\^`[\](),;!?]+/g;
  while ((match = bareUrlRegex.exec(content)) !== null) {
    let url = match[0];
    // Clean up trailing punctuation that might have been captured
    url = url.replace(/[.,;:!?]+$/, '');
    urls.add(url);
  }

  return Array.from(urls);
}

// Check if a link needs to be re-checked based on TTL and story state
function shouldCheckLink(url: string, ledger: z.infer<typeof LinkStatusLedgerSchema>, rootDir: string): boolean {
  const linkStatus = ledger.links[url];

  // Always check new links
  if (!linkStatus) {
    return true;
  }

  // Always re-check previously broken links
  if (linkStatus.status === 'broken') {
    return true;
  }

  // Apply 48-hour TTL only for active stories
  if (rootDir === 'active') {
    const lastChecked = new Date(linkStatus.lastChecked);
    const now = new Date();
    const hoursSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
    return hoursSinceCheck > 48;
  }

  // For published/archive stories, don't re-check healthy links
  return false;
}

async function check(workspacePath: string): Promise<RuleViolation[] | null> {
  const violations: RuleViolation[] = [];
  const scraper = new LinkScraper(); // Create instance per-check

  try {
    await scraper.initialize();

    for await (const { rootDir, storySlug, storyPath } of iterateStories(workspacePath)) {
      // Skip published and archive directories - no broken link checking needed
      if (rootDir === 'published' || rootDir === 'archive') {
        continue;
      }

      // Read blackboard to get latest essay file
      const blackboardPath = resolveProjectPath(storyPath, 'agents/blackboard.yaml');
      if (!(await fileExists(blackboardPath))) {
        continue;
      }

      // Use type-safe YAML parsing with zod validation
      try {
        const blackboardDataRaw = await readYamlFile(blackboardPath);
        const blackboardResult = BlackboardSchema.safeParse(blackboardDataRaw);

        if (!blackboardResult.success) {
          console.error(`Invalid blackboard structure in ${storySlug}:`, blackboardResult.error);
          continue;
        }

        const blackboard = blackboardResult.data;
        const latestFile = blackboard?.project_metadata?.latest_file;

        if (!latestFile) {
          continue;
        }

        const essayPath = resolveProjectPath(storyPath, latestFile);
        if (!(await fileExists(essayPath))) {
          continue;
        }

        // Read essay content and extract URLs
        const essayContent = await readFile(essayPath);
        const urls = extractUrls(essayContent);

        if (urls.length === 0) {
          continue;
        }

        // Read existing ledger or create new one
        const ledgerPath = resolveProjectPath(storyPath, 'link-status-ledger.json');
        let ledger: z.infer<typeof LinkStatusLedgerSchema> = {
          version: '1.0',
          links: {}
        };

        if (await fileExists(ledgerPath)) {
          try {
            const ledgerContent = await readFile(ledgerPath);
            const parsed = JSON.parse(ledgerContent) as z.infer<typeof LinkStatusLedgerSchema>;
            const result = LinkStatusLedgerSchema.safeParse(parsed);
            if (result.success) {
              ledger = result.data;
            }
          } catch (error) {
            // If ledger is corrupt, start fresh
            console.error(`Corrupt ledger in ${storySlug}, starting fresh:`, error);
          }
        }

        // Read link overrides if present
        const overridesPath = resolveProjectPath(storyPath, 'link-overrides.yaml');
        let overrides: Set<string> = new Set();

        if (await fileExists(overridesPath)) {
          try {
            const overridesDataRaw = await readYamlFile(overridesPath);
            const result = LinkOverridesSchema.safeParse(overridesDataRaw);
            if (result.success && result.data.overrides) {
              overrides = new Set(result.data.overrides.map((o) => o.url));
            }
          } catch (error) {
            console.error(`Error reading link overrides for ${storySlug}:`, error);
          }
        }

        // Determine which links need checking
        const linksToCheck = urls.filter((url) => shouldCheckLink(url, ledger, rootDir));

        // Check links in parallel
        const checkPromises = linksToCheck.map(async (url) => {
          try {
            const result = await scraper.checkLinkStatus(url);

            // Determine status based on HTTP code
            let status: 'healthy' | 'broken' | 'redirect' = 'healthy';
            if (result.status >= 400) {
              status = 'broken';
            } else if (result.status >= 300 && result.status < 400) {
              status = 'redirect';
            }

            // Update ledger
            ledger.links[url] = {
              url,
              status,
              httpStatus: result.status,
              finalUrl: result.finalUrl,
              lastChecked: new Date().toISOString(),
              retryCount: ledger.links[url]?.retryCount || 0
            };

            return { url, status };
          } catch (error) {
            // Record error in ledger
            ledger.links[url] = {
              url,
              status: 'broken',
              httpStatus: 503,
              finalUrl: url,
              lastChecked: new Date().toISOString(),
              retryCount: (ledger.links[url]?.retryCount || 0) + 1,
              lastError: error instanceof Error ? error.message : 'Unknown error'
            };

            return { url, status: 'broken' as const };
          }
        });

        // Wait for all checks to complete
        await Promise.all(checkPromises);

        // Prune removed URLs from ledger
        const currentUrls = new Set(urls);
        for (const url in ledger.links) {
          if (!currentUrls.has(url)) {
            delete ledger.links[url];
          }
        }

        // Write updated ledger
        await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2), 'utf-8');

        // Report violations for broken links not in overrides
        for (const url of urls) {
          const linkStatus = ledger.links[url];
          if (linkStatus?.status === 'broken' && !overrides.has(url)) {
            violations.push(
              createViolation(
                'BROKEN_LINK_DETECTED',
                `Broken link detected: \`${url}\` (HTTP ${linkStatus.httpStatus})`,
                `${rootDir}/${storySlug}/${latestFile}`,
                'error'
              )
            );
          }
        }
      } catch (error) {
        console.error(`Error processing blackboard for ${storySlug}:`, error);
        continue;
      }
    }
  } finally {
    // Always shutdown scraper to clean up browser resources
    await scraper.shutdown();
  }

  return violations.length > 0 ? violations : null;
}

const rule: Rule = {
  code: 'BROKEN_LINK_DETECTED',
  title: 'Broken Link Detected',
  check
};

export default rule;
