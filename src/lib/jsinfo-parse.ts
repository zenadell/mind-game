// Turns javascript.info's Markdown dialect into plain Markdown and splits a
// lesson into small chunks (one idea each). Pure functions, no file access,
// so they can be tested on their own.

const SITE = "https://javascript.info";

/** "04-variables" -> "variables" */
export function slugOf(dirName: string): string {
  return dirName.replace(/^\d+-/, "");
}

/** First "# Title" line, and everything after it. */
export function splitTitle(md: string): { title: string; body: string } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const i = lines.findIndex((l) => /^#\s+/.test(l));
  if (i === -1) return { title: "", body: md.trim() };
  return {
    title: lines[i].replace(/^#\s+/, "").trim(),
    body: lines.slice(i + 1).join("\n").trim(),
  };
}

/** Task files start with "importance: N\n\n---\n\n# Title". */
export function parseTaskFile(md: string): { importance: number; title: string; body: string } {
  let text = md.replace(/\r\n/g, "\n");
  let importance = 3;
  const m = text.match(/^importance:\s*(\d+)\s*\n+---\s*\n/);
  if (m) {
    importance = Number(m[1]);
    text = text.slice(m[0].length);
  }
  const { title, body } = splitTitle(text);
  return { importance, title, body };
}

const CALLOUTS: Record<string, string> = {
  smart: "💡",
  warn: "⚠️",
  online: "ℹ️",
  offline: "ℹ️",
  quote: "💬",
  compare: "⚖️",
};

/**
 * Convert javascript.info markup to standard Markdown.
 * `imageBase` is the public URL folder where this lesson's images live.
 */
export function cleanMarkdown(md: string, imageBase: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  // Stack of open fences: callouts become blockquotes, code stays code.
  const stack: { ticks: string; callout: boolean }[] = [];
  const quotePrefix = () => "> ".repeat(stack.filter((s) => s.callout).length);

  for (const raw of lines) {
    const line = raw;
    const top = stack[stack.length - 1];

    // Closing fence for whatever is open.
    if (top && line.trim() === top.ticks) {
      stack.pop();
      if (!top.callout) out.push(quotePrefix() + "```");
      else out.push(quotePrefix().trimEnd());
      continue;
    }

    const insideCode = top && !top.callout;
    const open = !insideCode && line.match(/^(`{3,4})(\w+)?(.*)$/);
    if (open) {
      const [, ticks, kind = "", rest] = open;
      if (kind in CALLOUTS) {
        const header = rest.match(/header="(.*)"\s*$/)?.[1] ?? (kind === "quote" ? "" : "");
        const author = rest.match(/author="([^"]*)"/)?.[1];
        out.push(quotePrefix() + `> **${CALLOUTS[kind]} ${header}**`.trimEnd());
        out.push(quotePrefix() + ">");
        stack.push({ ticks, callout: true });
        if (author) out.push(quotePrefix() + `— ${author}`);
        continue;
      }
      // Normal code fence: keep only the language ("js run no-beautify" -> "js").
      out.push(quotePrefix() + "```" + (kind === "compare" ? "" : kind));
      stack.push({ ticks, callout: false });
      continue;
    }

    let text = line;
    // Highlight markers used inside code examples.
    text = text.replace(/\*!\*|\*\/!\*/g, "");
    if (!insideCode) {
      if (/^\s*\[(cut|recent[^\]]*|demo[^\]]*)\]\s*$/.test(text)) continue;
      text = text.replace(
        /\[(iframe|codetabs|edit)[^\]]*\]/g,
        "*(There is an interactive demo for this on javascript.info.)*",
      );
      text = text.replace(/\]\(info:([^)#\s]+)(#[^)]*)?\)/g, (_m, slug, hash = "") => `](${SITE}/${slug}${hash})`);
      text = text.replace(/<info:([^>#\s]+)(#[^>]*)?>/g, (_m, slug, hash = "") => `[${slug}](${SITE}/${slug}${hash})`);
      text = text.replace(/\]\(task:([^)\s]+)\)/g, (_m, slug) => `](${SITE}/task/${slug})`);
      text = text.replace(/!\[([^\]]*)\]\((?!https?:)([^)\s]+)\)/g, (_m, alt, file) => `![${alt}](${imageBase}/${file})`);
    }
    if (insideCode && text.trim() === "" && raw.trim() !== "") continue; // marker-only line
    out.push(quotePrefix() + text);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface Chunk {
  heading: string;
  body: string;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Split cleaned Markdown at headings of the given level, ignoring code blocks. */
function splitAt(md: string, level: 2 | 3, fallbackHeading: string): Chunk[] {
  const marker = "#".repeat(level) + " ";
  const chunks: Chunk[] = [];
  let heading = fallbackHeading;
  let buf: string[] = [];
  let inCode = false;
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) chunks.push({ heading, body });
    buf = [];
  };
  for (const line of md.split("\n")) {
    if (/^(> )*```/.test(line)) inCode = !inCode;
    if (!inCode && line.startsWith(marker)) {
      flush();
      heading = line.slice(marker.length).replace(/\s*\[#[^\]]*\]\s*$/, "").trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return chunks;
}

const MAX_WORDS = 450;
const MIN_WORDS = 40;

/** Split a lesson into chunks: one per "##" section, smaller if a section is long. */
export function chunkLesson(title: string, md: string): Chunk[] {
  const out: Chunk[] = [];
  for (const section of splitAt(md, 2, title)) {
    if (wordCount(section.body) <= MAX_WORDS) {
      out.push(section);
      continue;
    }
    const parts = splitAt(section.body, 3, section.heading);
    parts.forEach((p, i) =>
      out.push({ heading: i === 0 ? section.heading : `${section.heading}: ${p.heading}`, body: p.body }),
    );
  }
  // Merge tiny chunks into the next one so each step has real content.
  const merged: Chunk[] = [];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (wordCount(c.body) < MIN_WORDS && i + 1 < out.length) {
      out[i + 1] = {
        heading: out[i + 1].heading,
        body: `**${c.heading}**\n\n${c.body}\n\n**${out[i + 1].heading}**\n\n${out[i + 1].body}`,
      };
      continue;
    }
    merged.push(c);
  }
  return merged;
}

/** Map javascript.info chapters to the semesters in the learning plan. */
export function semesterForChapter(chapterIndex: number): number {
  // 01 getting started .. 05 data types = JS fundamentals; the rest = intermediate JS.
  return chapterIndex <= 5 ? 1 : 3;
}
