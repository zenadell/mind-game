// Runs inside a Web Worker. The learner's code cannot touch the page, and the
// page kills the worker if it runs too long (e.g. an infinite loop).
// alert/prompt/confirm are faked: alert prints, prompt reads from the "inputs" list.
/* eslint-disable no-restricted-globals */

function fmt(v, depth = 0) {
  if (typeof v === "string") return depth ? JSON.stringify(v) : v;
  if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
  if (typeof v === "bigint") return v + "n";
  if (typeof v === "symbol") return v.toString();
  if (v === null || typeof v !== "object") return String(v);
  if (depth > 3) return Array.isArray(v) ? "[...]" : "{...}";
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (v instanceof Date) return v.toString();
  if (Array.isArray(v)) return "[" + v.map((x) => fmt(x, depth + 1)).join(", ") + "]";
  if (v instanceof Map) return `Map(${v.size}) {` + [...v].map(([k, x]) => `${fmt(k, depth + 1)} => ${fmt(x, depth + 1)}`).join(", ") + "}";
  if (v instanceof Set) return `Set(${v.size}) {` + [...v].map((x) => fmt(x, depth + 1)).join(", ") + "}";
  const keys = Object.keys(v);
  return "{ " + keys.map((k) => `${k}: ${fmt(v[k], depth + 1)}`).join(", ") + (keys.length ? " }" : "}");
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

class AssertionError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "AssertionError";
  }
}
function check(ok, msg) {
  if (!ok) throw new AssertionError(msg);
}
const assert = (v, m) => check(v, m || `expected ${fmt(v, 1)} to be truthy`);
Object.assign(assert, {
  ok: (v, m) => check(v, m || `expected ${fmt(v, 1)} to be truthy`),
  equal: (a, b, m) => check(a == b, m || `expected ${fmt(a, 1)} to equal ${fmt(b, 1)}`),
  notEqual: (a, b, m) => check(a != b, m || `expected ${fmt(a, 1)} to not equal ${fmt(b, 1)}`),
  strictEqual: (a, b, m) => check(a === b, m || `expected ${fmt(a, 1)} to be exactly ${fmt(b, 1)}`),
  notStrictEqual: (a, b, m) => check(a !== b, m || `expected ${fmt(a, 1)} to not be ${fmt(b, 1)}`),
  deepEqual: (a, b, m) => check(deepEqual(a, b), m || `expected ${fmt(a, 1)} to deeply equal ${fmt(b, 1)}`),
  isTrue: (v, m) => check(v === true, m || `expected ${fmt(v, 1)} to be true`),
  isFalse: (v, m) => check(v === false, m || `expected ${fmt(v, 1)} to be false`),
  isNaN: (v, m) => check(Number.isNaN(v), m || `expected ${fmt(v, 1)} to be NaN`),
  isNull: (v, m) => check(v === null, m || `expected ${fmt(v, 1)} to be null`),
  isUndefined: (v, m) => check(v === undefined, m || `expected ${fmt(v, 1)} to be undefined`),
  throws: (fn, _t, m) => {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    check(threw, m || "expected the function to throw an error");
  },
});

self.onmessage = async (e) => {
  const { code, tests, inputs = [] } = e.data;
  const logs = [];
  const log = (type) => (...args) => logs.push({ type, text: args.map((a) => fmt(a)).join(" ") });
  const queue = [...inputs];
  const fakeConsole = { log: log("log"), info: log("log"), debug: log("log"), warn: log("warn"), error: log("error") };
  self.alert = (m) => logs.push({ type: "alert", text: fmt(m === undefined ? "" : m) });
  self.prompt = (q, def) => {
    const v = queue.length ? queue.shift() : null;
    logs.push({ type: "prompt", text: `${fmt(q ?? "")} → ${v === null ? "null (no input left)" : v}` });
    return v;
  };
  self.confirm = (q) => {
    const v = queue.length ? /^(y|yes|true|ok|1)$/i.test(queue.shift().trim()) : false;
    logs.push({ type: "prompt", text: `${fmt(q ?? "")} → ${v}` });
    return v;
  };

  // Mocha-style test collection.
  const suites = [];
  const hooks = { before: [], after: [], beforeEach: [], afterEach: [] };
  const prefix = [];
  const api = {
    describe: (name, fn) => {
      prefix.push(name);
      fn();
      prefix.pop();
    },
    it: (name, fn) => suites.push({ name: [...prefix, name].join(" › "), fn }),
    before: (fn) => hooks.before.push(fn),
    after: (fn) => hooks.after.push(fn),
    beforeEach: (fn) => hooks.beforeEach.push(fn),
    afterEach: (fn) => hooks.afterEach.push(fn),
  };

  let error = null;
  try {
    const fn = new Function(
      "describe", "it", "before", "after", "beforeEach", "afterEach", "assert", "console",
      `"use strict";\n${code}\n;\n${tests || ""}`,
    );
    fn(api.describe, api.it, api.before, api.after, api.beforeEach, api.afterEach, assert, fakeConsole);
  } catch (err) {
    error = errorText(err);
  }

  let results = null;
  if (tests && !error) {
    results = [];
    const call = async (f) => (f.length ? new Promise((res) => f(res)) : f());
    try {
      for (const h of hooks.before) await call(h);
      for (const t of suites) {
        try {
          for (const h of hooks.beforeEach) await call(h);
          await call(t.fn);
          for (const h of hooks.afterEach) await call(h);
          results.push({ name: t.name, passed: true });
        } catch (err) {
          results.push({ name: t.name, passed: false, error: errorText(err) });
        }
      }
      for (const h of hooks.after) await call(h);
    } catch (err) {
      error = errorText(err);
    }
  }
  self.postMessage({ logs, error, results });
};

function errorText(err) {
  if (!(err instanceof Error)) return String(err);
  if (err.name === "AssertionError") return err.message;
  // Line numbers: our wrapper adds 3 lines before the learner's code.
  const m = String(err.stack || "").match(/<anonymous>:(\d+):\d+/);
  const line = m ? Number(m[1]) - 3 : null;
  return `${err.name}: ${err.message}${line && line > 0 ? ` (line ${line})` : ""}`;
}
