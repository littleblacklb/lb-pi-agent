/**
 * Catalog building for model-skill-gate (visibility mode).
 *
 * Superpowers skills live OUTSIDE pi's scan locations, so no model sees them
 * natively. For a gated model we merge their catalog entries — pi's native
 * <available_skills> XML shape (name/description/location) — into the system
 * prompt on every user turn (`before_agent_start`). Nothing is auto-loaded:
 * the model reads a SKILL.md on demand when the task matches the description,
 * exactly like pi's own skill mechanism.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** Expand a leading `~` to the home directory; otherwise resolve to absolute. */
export function expandPath(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return isAbsolute(p) ? p : resolve(p);
}

/** One advertised skill entry (native pi skill XML semantics). */
export interface CatalogEntry {
  name: string;
  description: string;
  /** Absolute path of the SKILL.md the model can read on demand. */
  location: string;
}

type RawEntry = CatalogEntry & { mtimeMs: number };

const entryCache = new Map<string, RawEntry>();

/** Extract a single YAML-ish frontmatter field value. */
export function frontmatterField(content: string, key: string): string | undefined {
  const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!m) return undefined;
  return m[1]!.trim().replace(/^["']|["']$/g, "");
}

/** Read a SKILL.md file, re-reading only when mtime changed. */
export function readSkillEntry(file: string): RawEntry | null {
  let st;
  try {
    st = statSync(file);
  } catch {
    return null;
  }
  const cached = entryCache.get(file);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached;
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const name = frontmatterField(raw, "name") ?? dirname(file).split(/[\\/]/).pop() ?? "skill";
  const description = frontmatterField(raw, "description") ?? "";
  const entry: RawEntry = { name, description, location: file, mtimeMs: st.mtimeMs };
  entryCache.set(file, entry);
  return entry;
}

function isMarkdownFile(p: string): boolean {
  return p.toLowerCase().endsWith(".md");
}

function addEntry(out: Map<string, CatalogEntry>, entry: RawEntry | null): void {
  if (!entry) return;
  // Dedupe by canonical location (a dir may be reachable via several specs).
  const key = resolve(entry.location);
  if (out.has(key)) return;
  out.set(key, { name: entry.name, description: entry.description, location: entry.location });
}

/**
 * Collect catalog entries from the given source dirs.
 *
 * Each source contributes:
 * - itself, when it contains SKILL.md (a skill root such as using-superpowers),
 * - every direct child directory containing SKILL.md (a skills/ collection),
 * - or the source itself when it points directly at a .md file.
 */
export function buildCatalog(sources: string[]): CatalogEntry[] {
  const out = new Map<string, CatalogEntry>();
  for (const rawSource of sources) {
    const abs = expandPath(rawSource);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue; // Missing source dirs are skipped silently (misconfig logged by caller).
    }
    if (st.isFile() && isMarkdownFile(abs)) {
      addEntry(out, readSkillEntry(abs));
      continue;
    }
    if (!st.isDirectory()) continue;
    addEntry(out, readSkillEntry(join(abs, "SKILL.md")));
    let children;
    try {
      children = readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory()) continue;
      addEntry(out, readSkillEntry(join(abs, child.name, "SKILL.md")));
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Serialize entries as native pi <skill> XML fragments (no wrapper) so they
 * can be merged into the prompt's own <available_skills> block.
 */
export function entriesToXml(entries: CatalogEntry[]): string {
  const lines: string[] = [];
  for (const skill of entries) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push(`    <location>${escapeXml(skill.location)}</location>`);
    lines.push("  </skill>");
  }
  return lines.join("\n");
}

/** Same intro pi uses before its native catalog block. */
export const CATALOG_INTRO =
  "The following skills provide specialized instructions for specific tasks.\n" +
  "Use the read tool to load a skill's file when the task matches its description.\n" +
  "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.";

export interface InjectResult {
  prompt: string;
  /** Entries added to the prompt. */
  inserted: number;
  /** Entries that were already present (deduped by location). */
  existing: number;
}

/**
 * Merge catalog entries into a base system prompt.
 *
 * - When the prompt already has an <available_skills> block, entries whose
 *   <location> is not already inside it are inserted before </available_skills>
 *   (keeps native skills and ours side by side).
 * - Otherwise (custom prompts without a skills section) the standard section
 *   with the intro is appended at the end.
 */
export function injectCatalog(basePrompt: string, entries: CatalogEntry[]): InjectResult {
  if (entries.length === 0) return { prompt: basePrompt, inserted: 0, existing: 0 };

  const open = basePrompt.indexOf("<available_skills>");
  const close = open >= 0 ? basePrompt.indexOf("</available_skills>", open) : -1;
  const toAdd = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    toAdd.set(resolve(entry.location), entry);
  }

  if (open >= 0 && close > open) {
    const region = basePrompt.slice(open, close);
    const existing = new Set<string>();
    for (const entry of toAdd.values()) {
      if (region.includes(`<location>${escapeXml(entry.location)}</location>`)) {
        existing.add(resolve(entry.location));
      }
    }
    for (const key of existing) toAdd.delete(key);
    if (toAdd.size === 0) return { prompt: basePrompt, inserted: 0, existing: existing.size };

    const fragment = entriesToXml([...toAdd.values()]);
    const prompt =
      basePrompt.slice(0, close) + fragment + "\n" + basePrompt.slice(close);
    return { prompt, inserted: toAdd.size, existing: existing.size };
  }

  const block = `<available_skills>\n${entriesToXml(entries)}\n</available_skills>`;
  const prompt = `${basePrompt.replace(/\s+$/, "")}\n\n${CATALOG_INTRO}\n\n${block}\n`;
  return { prompt, inserted: entries.length, existing: 0 };
}
