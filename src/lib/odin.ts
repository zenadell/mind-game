// The Odin Project sections that go with each javascript.info lesson.
// Odin gives beginner context (how the web works, HTML, running JS in a page) and
// javascript.info gives the depth. Both are shown as the authors wrote them.
// Odin's curriculum is CC BY-NC-SA 4.0: https://github.com/TheOdinProject/curriculum

const F = "foundations";
const J = "javascript";
const WEB = `${F}/introduction/introduction_to_web_development.md`;
const VARS = `${F}/javascript_basics/variables_and_operators.md`;
const TYPES = `${F}/javascript_basics/data_types_and_conditionals.md`;
const LOOPS = `${F}/javascript_basics/loops_and_arrays.md`;
const OBJ = `${F}/javascript_basics/object_basics.md`;
const CLEAN = `${F}/javascript_basics/clean_code.md`;
const BOILER = `${F}/html_css/html_foundations/html_boilerplate.md`;

/**
 * javascript.info lesson id -> Odin sources, shown before the javascript.info text.
 * "path" means every teaching section of that Odin lesson; "path#Heading" means only that
 * section. Each Odin section is used in exactly one lesson, so nothing is repeated.
 */
export const ODIN_FOR: Record<string, string[]> = {
  intro: [
    `${WEB}#Introduction`,
    `${WEB}#Types of web developers`,
    `${WEB}#Tools of the trade`,
    `${F}/installations/how_does_the_web_work.md`,
    `${F}/html_css/html_foundations/intro_to_html_css.md`,
    `${F}/html_css/html_foundations/elements_and_tags.md`,
  ],
  "code-editors": [`${F}/installations/text_editors.md`],
  devtools: [`${F}/javascript_basics/javascript_developer_tools.md`],
  "hello-world": [
    `${BOILER}#Creating an HTML file`,
    `${BOILER}#The DOCTYPE`,
    `${BOILER}#HTML element`,
    `${BOILER}#Head element`,
    `${BOILER}#Body element`,
    `${BOILER}#Viewing HTML files in the browser`,
    `${VARS}#How to run JavaScript code`,
  ],
  variables: [`${VARS}#Variables`],
  operators: [`${VARS}#Numbers`],
  types: [`${TYPES}#Strings`],
  ifelse: [`${TYPES}#Conditionals`],
  "while-for": [`${LOOPS}#Loops`],
  "function-basics": [`${F}/javascript_basics/function_basics.md`],
  "debugging-chrome": [`${F}/javascript_basics/understanding_errors.md`],
  "coding-style": [
    `${CLEAN}#What is clean code?`,
    `${CLEAN}#Naming functions and variables`,
    `${CLEAN}#Use searchable and immediately understandable names`,
    `${CLEAN}#Indentation and line length`,
    `${CLEAN}#Semicolons`,
    `${CLEAN}#In conclusion`,
  ],
  comments: [`${CLEAN}#About comments`],
  object: [`${OBJ}#Objects`],
  "object-copy": [`${OBJ}#Differences between objects and primitives`],
  array: [`${LOOPS}#Arrays`],
  "array-methods": [`${LOOPS}#Some examples of array magic`],
  "constructor-new": [`${J}/organizing_your_javascript_code/object_constructors.md`],
  json: [`${J}/organizing_your_javascript_code/json.md`],
  closure: [`${J}/organizing_your_javascript_code/factory_functions_and_module_pattern.md`],
  class: [`${J}/organizing_your_javascript_code/classes.md`],
  "promise-basics": [`${J}/asynchronous_javascript_and_apis/asynchronous_code.md`],
  "async-await": [`${J}/asynchronous_javascript_and_apis/async_and_await.md`],
  "modules-intro": [`${J}/organizing_your_javascript_code/es6_modules.md`],
};

/** "file.md#Heading" -> { path, heading } */
export function parseSpec(spec: string): { path: string; heading: string | null } {
  const i = spec.indexOf("#");
  return i === -1 ? { path: spec, heading: null } : { path: spec.slice(0, i), heading: spec.slice(i + 1) };
}

/** GitHub link to an Odin lesson file (always correct, unlike guessed site URLs). */
export function odinUrl(path: string): string {
  return `https://github.com/TheOdinProject/curriculum/blob/main/${path}`;
}

/** "foundations/javascript_basics/variables_and_operators.md" -> "Variables and operators" */
export function odinTitle(path: string): string {
  const name = path.split("/").pop()!.replace(/\.md$/, "").replace(/[_-]+/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Strip Odin's HTML wrappers (outside code blocks) and keep the Markdown. */
export function cleanOdin(md: string): string {
  const out: string[] = [];
  let inCode = false;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    if (!inCode && /^\s*<\/?(div|span|details|summary)\b[^>]*>\s*$/.test(line)) continue;
    out.push(inCode ? line : line.replace(/<kbd>(.*?)<\/kbd>/g, "`$1`"));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Sections that are lists of links or course admin, not teaching text. */
const NOT_TEACHING = /^(lesson overview|assignment|knowledge check|additional resources)$/i;

export type OdinParts = {
  goals: string[]; // from "Lesson overview"
  sections: { heading: string; body: string }[];
  reading: { text: string; url: string }[]; // links from "Assignment"
};

/** Split a cleaned Odin lesson into its goals, teaching sections and reading links. */
export function splitOdin(md: string): OdinParts {
  const parts: OdinParts = { goals: [], sections: [], reading: [] };
  let heading = "";
  let buf: string[] = [];
  let inCode = false;
  const flush = () => {
    const body = buf.join("\n").trim();
    buf = [];
    if (!heading || !body) return;
    if (/^lesson overview$/i.test(heading)) {
      parts.goals = body.split("\n").filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
    } else if (/^assignment$/i.test(heading)) {
      for (const m of body.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)) parts.reading.push({ text: m[1], url: m[2] });
    } else if (!NOT_TEACHING.test(heading)) {
      parts.sections.push({ heading, body });
    }
  };
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    if (!inCode && /^### /.test(line)) {
      flush();
      heading = line.slice(4).trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return parts;
}
