import { afterAll, describe, expect, it } from "vitest";
import {
  buildCatalog,
  CATALOG_INTRO,
  entriesToXml,
  escapeXml,
  frontmatterField,
  injectCatalog,
  type CatalogEntry,
} from "./catalog";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cleanups: string[] = [];
afterAll(() => {
  for (const root of cleanups) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

function mk(meta: { name?: string; description?: string } = {}): string {
  return `---\nname: ${meta.name ?? ""}\ndescription: ${meta.description ?? ""}\n---\n\n# body\n`;
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "msg-catalog-"));
  cleanups.push(root);
  const write = (rel: string, content: string) => {
    const p = join(root, rel);
    mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
    writeFileSync(p, content, "utf8");
  };
  write("gated/using-superpowers/SKILL.md", mk({ name: "using-superpowers", description: "master skill" }));
  write("gated/using-superpowers/child.md", "irrelevant");
  write("gated/skills/brainstorming/SKILL.md", mk({ name: "brainstorming", description: "ideation & planning" }));
  write("gated/skills/systematic-debugging/SKILL.md", mk({ name: "systematic-debugging", description: "root-cause process" }));
  write("gated/skills/not-a-skill/notes.txt", "no skill frontmatter here");
  write("gated/other.md", mk({ name: "other-file-skill", description: "direct file skill" }));
  return root;
}

describe("catalog", () => {
  it("escapes xml special characters", () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe("a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  });

  it("frontmatterField extracts single-line values", () => {
    expect(frontmatterField(mk({ name: "n", description: "d" }), "description")).toBe("d");
    expect(frontmatterField("no frontmatter", "name")).toBeUndefined();
  });

  it("builds catalog entries from roots and their child skill dirs", () => {
    const root = fixture();
    const entries = buildCatalog([
      join(root, "gated/using-superpowers"),
      join(root, "gated/skills"),
    ]);
    const byLocation = new Map(entries.map((e) => [e.location, e]));
    expect(byLocation.size).toBe(entries.length);

    const using = byLocation.get(join(root, "gated/using-superpowers/SKILL.md"));
    expect(using).toMatchObject({ name: "using-superpowers", description: "master skill" });

    const brainstorm = byLocation.get(join(root, "gated/skills/brainstorming/SKILL.md"));
    expect(brainstorm).toMatchObject({ name: "brainstorming", description: "ideation & planning" });

    // dirs without SKILL.md are skipped
    expect(byLocation.has(join(root, "gated/skills/not-a-skill/notes.txt"))).toBe(false);
    // sorted by name
    const names = entries.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("accepts direct markdown file sources and dedupes by location", () => {
    const root = fixture();
    const entries = buildCatalog([
      join(root, "gated/other.md"),
      join(root, "gated/other.md"), // duplicate source
      join(root, "gated/using-superpowers/SKILL.md"), // the SKILL.md itself as source
      join(root, "gated/using-superpowers"), // its parent dir as source
    ]);
    expect(entries).toHaveLength(2);
  });

  it("skips missing source dirs", () => {
    expect(buildCatalog(["/nonexistent/msg-gate-dir-xyz"])).toEqual([]);
  });

  it("serializes native <skill> xml fragments", () => {
    const entries: CatalogEntry[] = [
      { name: "a&b", description: 'say "hi"', location: "/x/SKILL.md" },
    ];
    const xml = entriesToXml(entries);
    expect(xml).toContain("<skill>");
    expect(xml).toContain("<name>a&amp;b</name>");
    expect(xml).toContain('<description>say &quot;hi&quot;</description>');
    expect(xml).toContain("<location>/x/SKILL.md</location>");
  });

  it("merges entries into an existing <available_skills> block, deduped by location", () => {
    const root = fixture();
    const entries = buildCatalog([
      join(root, "gated/using-superpowers"),
      join(root, "gated/skills"),
    ]);
    const native =
      "<available_skills>\n  <skill>\n    <name>existing</name>\n    <description>d</description>\n    <location>/native/existing/SKILL.md</location>\n  </skill>\n</available_skills>";
    const res = injectCatalog(`prefix ${native} suffix`, entries);
    expect(res.inserted).toBe(3);
    expect(res.existing).toBe(0);
    // native entries untouched: the existing skill and the closing tag survive
    expect(res.prompt).toContain(
      `<location>/native/existing/SKILL.md</location>\n  </skill>\n`,
    );
    expect(res.prompt).toContain("</available_skills> suffix");
    for (const e of entries) {
      expect(res.prompt).toContain(`<location>${e.location}</location>`);
    }
    expect(res.prompt.indexOf("</available_skills>")).toBeGreaterThan(
      res.prompt.indexOf(`<location>${entries[0]!.location}</location>`),
    );
    expect(res.prompt).toContain("prefix ");
    expect(res.prompt).toContain(" suffix");
  });

  it("skips entries already present in the base prompt", () => {
    const entry: CatalogEntry = { name: "x", description: "d", location: "/a/SKILL.md" };
    const base =
      "<available_skills>\n  <skill>\n    <name>existing</name>\n    <description>d</description>\n    <location>/a/SKILL.md</location>\n  </skill>\n</available_skills>";
    const res = injectCatalog(base, [entry]);
    expect(res.inserted).toBe(0);
    expect(res.existing).toBe(1);
    expect(res.prompt).toBe(base);
  });

  it("appends a full section when the prompt has no skills block", () => {
    const entry: CatalogEntry = { name: "x", description: "d", location: "/a/SKILL.md" };
    const res = injectCatalog("base prompt no skills", [entry]);
    expect(res.inserted).toBe(1);
    expect(res.prompt).toContain(CATALOG_INTRO);
    expect(res.prompt).toContain("<available_skills>");
    expect(res.prompt).toContain("<location>/a/SKILL.md</location>");
    expect(res.prompt.endsWith("</available_skills>\n")).toBe(true);
  });

  it("does nothing for empty entry lists", () => {
    const res = injectCatalog("anything", []);
    expect(res.prompt).toBe("anything");
  });
});
