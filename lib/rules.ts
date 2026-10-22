// Pure helpers for splitting the rules HTML into sections and back.
// No DOM access, so these work on the server and in the browser.

export type RuleSection = {
  id: string;     // anchor slug, e.g. "trades"
  title: string;  // plain text
  html: string;   // section body HTML
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function withUniqueIds(sections: Omit<RuleSection, "id">[]): RuleSection[] {
  const seen = new Map<string, number>();
  return sections.map((s) => {
    const base = slugify(s.title);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...s, id: n === 0 ? base : `${base}-${n + 1}` };
  });
}

/**
 * Split rules HTML into sections.
 * Sections start at <h1>/<h2>. Older content that only used <h3> as section
 * headings is split on <h3> instead. Text before the first heading becomes "Overview".
 */
export function parseRules(html: string): RuleSection[] {
  const source = (html ?? "").trim();
  if (!source) return [];

  const levels = /<h[12][\s>]/i.test(source) ? "h[12]" : /<h3[\s>]/i.test(source) ? "h3" : null;
  if (!levels) return withUniqueIds([{ title: "Rules", html: source }]);

  const re = new RegExp(`<(${levels})[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  const raw: Omit<RuleSection, "id">[] = [];
  let lastIndex = 0;
  let currentTitle: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    const body = source.slice(lastIndex, m.index).trim();
    if (currentTitle !== null) raw.push({ title: currentTitle, html: body });
    else if (stripHtml(body)) raw.push({ title: "Overview", html: body });
    currentTitle = stripHtml(m[2]) || "Untitled section";
    lastIndex = m.index + m[0].length;
  }
  if (currentTitle !== null) raw.push({ title: currentTitle, html: source.slice(lastIndex).trim() });

  return withUniqueIds(raw);
}

/** Turn sections back into one HTML document (h2 per section). */
export function serializeRules(sections: { title: string; html: string }[]): string {
  return sections
    .map((s) => {
      const body = s.html.trim() === "<p></p>" ? "" : s.html.trim();
      return `<h2>${escapeHtml(s.title.trim() || "Untitled section")}</h2>${body}`;
    })
    .join("\n");
}
