// The Odin Project lessons that go with each javascript.info lesson.
// Odin gives the beginner context (how the web works, HTML, running JS in a page)
// and a checklist of goals; javascript.info gives the depth. The tutor merges both.
// Odin's curriculum is CC BY-NC-SA 4.0: https://github.com/TheOdinProject/curriculum

const F = "foundations";
const J = "javascript";

/** javascript.info lesson id -> Odin lesson file paths (relative to the curriculum repo). */
export const ODIN_FOR: Record<string, string[]> = {
  intro: [
    `${F}/introduction/introduction_to_web_development.md`,
    `${F}/installations/how_does_the_web_work.md`,
    `${F}/html_css/html_foundations/intro_to_html_css.md`,
    `${F}/html_css/html_foundations/elements_and_tags.md`,
  ],
  "code-editors": [`${F}/installations/text_editors.md`],
  devtools: [`${F}/javascript_basics/javascript_developer_tools.md`],
  "hello-world": [`${F}/javascript_basics/variables_and_operators.md`, `${F}/html_css/html_foundations/html_boilerplate.md`],
  variables: [`${F}/javascript_basics/variables_and_operators.md`],
  types: [`${F}/javascript_basics/data_types_and_conditionals.md`],
  "type-conversions": [`${F}/javascript_basics/data_types_and_conditionals.md`],
  operators: [`${F}/javascript_basics/variables_and_operators.md`],
  comparison: [`${F}/javascript_basics/data_types_and_conditionals.md`],
  ifelse: [`${F}/javascript_basics/data_types_and_conditionals.md`],
  "logical-operators": [`${F}/javascript_basics/data_types_and_conditionals.md`],
  "while-for": [`${F}/javascript_basics/loops_and_arrays.md`],
  "function-basics": [`${F}/javascript_basics/function_basics.md`],
  "function-expressions": [`${F}/javascript_basics/function_basics.md`],
  "arrow-functions-basics": [`${F}/javascript_basics/function_basics.md`],
  "debugging-chrome": [`${F}/javascript_basics/javascript_developer_tools.md`, `${F}/javascript_basics/understanding_errors.md`],
  "coding-style": [`${F}/javascript_basics/clean_code.md`],
  comments: [`${F}/javascript_basics/clean_code.md`],
  object: [`${F}/javascript_basics/object_basics.md`],
  "object-copy": [`${F}/javascript_basics/object_basics.md`],
  "constructor-new": [`${J}/organizing_your_javascript_code/object_constructors.md`],
  string: [`${F}/javascript_basics/data_types_and_conditionals.md`],
  number: [`${F}/javascript_basics/variables_and_operators.md`],
  array: [`${F}/javascript_basics/loops_and_arrays.md`],
  "array-methods": [`${F}/javascript_basics/loops_and_arrays.md`],
  json: [`${J}/organizing_your_javascript_code/json.md`],
  closure: [`${J}/organizing_your_javascript_code/factory_functions_and_module_pattern.md`],
  "prototype-inheritance": [`${J}/organizing_your_javascript_code/object_constructors.md`],
  class: [`${J}/organizing_your_javascript_code/classes.md`],
  "try-catch": [`${F}/javascript_basics/understanding_errors.md`],
  "promise-basics": [`${J}/asynchronous_javascript_and_apis/asynchronous_code.md`],
  "async-await": [`${J}/asynchronous_javascript_and_apis/async_and_await.md`],
  "modules-intro": [`${J}/organizing_your_javascript_code/es6_modules.md`],
};

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
