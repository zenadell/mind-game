// The training problem bank: classic interview problems, grouped by the patterns big tech
// interviews test (the same patterns as the "Blind 75" / "NeetCode 150" lists).
// Statements are written for CodeTutor; each links to the matching LeetCode problem so the
// learner can also solve the original there. Every reference solution is run against every
// test case by the test suite, so the answer keys are checked.
// This file has no server imports: the browser uses it to build the tests it runs.

export type Difficulty = "Easy" | "Medium" | "Hard";
/** How answers are compared: exactly, ignoring order, or ignoring order at both levels. */
export type Compare = "exact" | "unordered" | "unorderedDeep" | "float";
/** Special input/output shapes: linked lists and binary trees are written as arrays. */
export type Shape = "value" | "list" | "lists" | "tree";

export type Problem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  pattern: string;
  /** Lessons that must be completed first (javascript.info lesson ids). */
  requires: string[];
  leetcode?: { n: number; slug: string; title: string };
  fn: string;
  params: string[];
  statement: string;
  /** First cases are the visible examples; the rest are hidden tests. */
  examples: number;
  cases: { args: unknown[]; out: unknown }[];
  compare?: Compare;
  argShapes?: Shape[];
  returns?: Shape;
  complexity: string;
  /** Reference solution (secret until solved). */
  ref: string;
  /** Design problems: `fn` is a class name, `params` its constructor's, and each case is
   * `args: [constructorArgs, methodNames, argLists]` with `out` the list of return values (null for none). */
  methods?: { name: string; params: string[] }[];
};

export const PATTERNS: { id: string; title: string; blurb: string }[] = [
  { id: "warmup", title: "Warm-up", blurb: "Loops, conditions and functions. Get your hands moving." },
  { id: "strings", title: "Strings", blurb: "Walk through text one character at a time." },
  { id: "hashing", title: "Arrays & Hashing", blurb: "Use objects, Maps and Sets to remember what you've seen." },
  { id: "two-pointers", title: "Two Pointers", blurb: "Two indexes moving toward each other (or together)." },
  { id: "sliding-window", title: "Sliding Window", blurb: "A window over the array that grows and shrinks." },
  { id: "stack", title: "Stack", blurb: "Last in, first out: brackets, undo, the nearest bigger value." },
  { id: "binary-search", title: "Binary Search", blurb: "Halve the search space every step." },
  { id: "linked-list", title: "Linked List", blurb: "Nodes that point to the next node." },
  { id: "trees", title: "Trees", blurb: "Recursion on nodes with left and right children." },
  { id: "dp", title: "Dynamic Programming", blurb: "Build the answer from answers to smaller problems." },
  { id: "graphs", title: "Graphs", blurb: "Grids and networks: explore neighbours." },
  { id: "backtracking", title: "Backtracking", blurb: "Try a choice, explore, undo, try the next." },
  { id: "intervals", title: "Intervals", blurb: "Sort by start, then merge or insert." },
  { id: "greedy", title: "Greedy", blurb: "Make the best local choice every step." },
  { id: "real-world", title: "Real-world code", blurb: "Utilities real apps are full of: parsing, grouping, flattening." },
  { id: "design", title: "Design & build", blurb: "Build a class with several methods, like real systems (caches, search boxes)." },
];

const BASICS = ["function-basics", "while-for", "ifelse"];
const ARR = [...BASICS, "array"];
const ARRM = [...ARR, "array-methods"];
const STR = [...BASICS, "string"];
const HASH = [...ARR, "map-set", "object"];
const REC = [...ARR, "object", "recursion"];
const CLS = [...HASH, "class"];

const lc = (n: number, slug: string, title: string) => ({ n, slug, title });
const c = (args: unknown[], out: unknown) => ({ args, out });

export const PROBLEMS: Problem[] = [
  // ---------------- Warm-up ----------------
  {
    id: "fizzbuzz",
    title: "FizzBuzz (one number)",
    difficulty: "Easy",
    pattern: "warmup",
    requires: BASICS,
    leetcode: lc(412, "fizz-buzz", "Fizz Buzz"),
    fn: "fizzBuzz",
    params: ["n"],
    statement:
      "Write a function `fizzBuzz(n)` that returns a **string**:\n\n- `\"FizzBuzz\"` if `n` can be divided by both 3 and 5,\n- `\"Fizz\"` if it can be divided by 3,\n- `\"Buzz\"` if it can be divided by 5,\n- otherwise the number itself as a string, like `\"7\"`.\n\nThis is one of the most famous interview warm-ups.",
    examples: 3,
    cases: [c([3], "Fizz"), c([10], "Buzz"), c([15], "FizzBuzz"), c([7], "7"), c([1], "1"), c([30], "FizzBuzz"), c([9], "Fizz"), c([25], "Buzz")],
    complexity: "O(1) time, O(1) space",
    ref: `function fizzBuzz(n) {
  if (n % 15 === 0) return "FizzBuzz";
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}`,
  },
  {
    id: "sum-to",
    title: "Sum from 1 to n",
    difficulty: "Easy",
    pattern: "warmup",
    requires: BASICS,
    fn: "sumTo",
    params: ["n"],
    statement:
      "Write `sumTo(n)` that returns `1 + 2 + ... + n`. If `n` is 0, return 0.\n\nFirst solve it with a loop. Then think: is there a way without a loop? (Interviewers love asking that.)",
    examples: 2,
    cases: [c([3], 6), c([1], 1), c([0], 0), c([10], 55), c([100], 5050)],
    complexity: "O(n) with a loop, or O(1) with the formula n*(n+1)/2",
    ref: `function sumTo(n) {
  return (n * (n + 1)) / 2;
}`,
  },
  {
    id: "power-of-two",
    title: "Power of Two",
    difficulty: "Easy",
    pattern: "warmup",
    requires: BASICS,
    leetcode: lc(231, "power-of-two", "Power of Two"),
    fn: "isPowerOfTwo",
    params: ["n"],
    statement:
      "Return `true` if `n` is a power of two (1, 2, 4, 8, 16, …), otherwise `false`. `n` can be zero or negative.",
    examples: 3,
    cases: [c([1], true), c([16], true), c([3], false), c([0], false), c([-8], false), c([1024], true), c([6], false)],
    complexity: "O(log n) time with a loop, O(1) space",
    ref: `function isPowerOfTwo(n) {
  if (n < 1) return false;
  while (n % 2 === 0) n = n / 2;
  return n === 1;
}`,
  },
  {
    id: "palindrome-number",
    title: "Palindrome Number",
    difficulty: "Easy",
    pattern: "warmup",
    requires: BASICS,
    leetcode: lc(9, "palindrome-number", "Palindrome Number"),
    fn: "isPalindromeNumber",
    params: ["x"],
    statement:
      "Return `true` if the integer `x` reads the same forwards and backwards, like `121`. Negative numbers are never palindromes (`-121` reads `121-` backwards).\n\nChallenge: solve it **without** turning the number into a string, using `%` and division.",
    examples: 3,
    cases: [c([121], true), c([-121], false), c([10], false), c([0], true), c([12321], true), c([1231], false)],
    complexity: "O(number of digits) time, O(1) space",
    ref: `function isPalindromeNumber(x) {
  if (x < 0) return false;
  let rev = 0, n = x;
  while (n > 0) { rev = rev * 10 + (n % 10); n = Math.floor(n / 10); }
  return rev === x;
}`,
  },
  {
    id: "fibonacci",
    title: "Fibonacci Number",
    difficulty: "Easy",
    pattern: "warmup",
    requires: BASICS,
    leetcode: lc(509, "fibonacci-number", "Fibonacci Number"),
    fn: "fib",
    params: ["n"],
    statement:
      "The Fibonacci numbers start `0, 1, 1, 2, 3, 5, 8, …`: each number is the sum of the two before it. Return the `n`-th one, where `fib(0) = 0` and `fib(1) = 1`.\n\nWatch out: a simple recursive solution is very slow for `n = 40`. Can you make it fast?",
    examples: 3,
    cases: [c([2], 1), c([3], 2), c([4], 3), c([0], 0), c([1], 1), c([10], 55), c([40], 102334155)],
    complexity: "O(n) time, O(1) space",
    ref: `function fib(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}`,
  },
  {
    id: "count-primes",
    title: "Count Primes",
    difficulty: "Medium",
    pattern: "warmup",
    requires: ARR,
    leetcode: lc(204, "count-primes", "Count Primes"),
    fn: "countPrimes",
    params: ["n"],
    statement:
      "Return how many prime numbers are **less than** `n`. A prime is a number bigger than 1 that can only be divided by 1 and itself (2, 3, 5, 7, 11, …).\n\nChecking every number one by one is slow when `n` is 100000. Look up the *Sieve of Eratosthenes*.",
    examples: 2,
    cases: [c([10], 4), c([0], 0), c([1], 0), c([2], 0), c([3], 1), c([100], 25), c([100000], 9592)],
    complexity: "O(n log log n) time, O(n) space (sieve)",
    ref: `function countPrimes(n) {
  if (n < 3) return 0;
  const composite = new Array(n).fill(false);
  let count = 0;
  for (let i = 2; i < n; i++) {
    if (composite[i]) continue;
    count++;
    for (let j = i * i; j < n; j += i) composite[j] = true;
  }
  return count;
}`,
  },

  // ---------------- Strings ----------------
  {
    id: "reverse-string",
    title: "Reverse a String",
    difficulty: "Easy",
    pattern: "strings",
    requires: STR,
    leetcode: lc(344, "reverse-string", "Reverse String"),
    fn: "reverseString",
    params: ["s"],
    statement: "Return the string `s` written backwards. Do it with a loop (no `.reverse()`), so you understand what is happening.",
    examples: 2,
    cases: [c(["hello"], "olleh"), c(["ab"], "ba"), c([""], ""), c(["a"], "a"), c(["racecar"], "racecar")],
    complexity: "O(n) time, O(n) space",
    ref: `function reverseString(s) {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += s[i];
  return out;
}`,
  },
  {
    id: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    pattern: "two-pointers",
    requires: STR,
    leetcode: lc(125, "valid-palindrome", "Valid Palindrome"),
    fn: "isPalindrome",
    params: ["s"],
    statement:
      "A phrase is a palindrome if, after making all letters lowercase and removing everything that is not a letter or a digit, it reads the same forwards and backwards.\n\nReturn `true` if `s` is a palindrome. Can you do it without building a new, cleaned-up string?",
    examples: 3,
    cases: [
      c(["A man, a plan, a canal: Panama"], true),
      c(["race a car"], false),
      c([" "], true),
      c(["0P"], false),
      c(["No 'x' in Nixon"], true),
      c(["ab_a"], true),
    ],
    complexity: "O(n) time, O(1) space with two pointers",
    ref: `function isPalindrome(s) {
  const ok = (ch) => /[a-z0-9]/i.test(ch);
  let i = 0, j = s.length - 1;
  while (i < j) {
    if (!ok(s[i])) { i++; continue; }
    if (!ok(s[j])) { j--; continue; }
    if (s[i].toLowerCase() !== s[j].toLowerCase()) return false;
    i++; j--;
  }
  return true;
}`,
  },
  {
    id: "longest-common-prefix",
    title: "Longest Common Prefix",
    difficulty: "Easy",
    pattern: "strings",
    requires: [...STR, "array"],
    leetcode: lc(14, "longest-common-prefix", "Longest Common Prefix"),
    fn: "longestCommonPrefix",
    params: ["strs"],
    statement: "Given an array of words, return the longest starting part that **all** of them share. If they share nothing, return `\"\"`.",
    examples: 2,
    cases: [c([["flower", "flow", "flight"]], "fl"), c([["dog", "racecar", "car"]], ""), c([["a"]], "a"), c([["", "b"]], ""), c([["interview", "internet", "interval"]], "inter")],
    complexity: "O(total characters) time, O(1) extra space",
    ref: `function longestCommonPrefix(strs) {
  let prefix = strs[0];
  for (const s of strs) while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}`,
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    pattern: "stack",
    requires: [...STR, "array"],
    leetcode: lc(20, "valid-parentheses", "Valid Parentheses"),
    fn: "isValid",
    params: ["s"],
    statement:
      "`s` contains only the characters `( ) [ ] { }`. Return `true` if every opening bracket is closed by the same kind of bracket, in the right order.\n\n`\"([])\"` is valid. `\"(]\"` and `\"([)]\"` are not.",
    examples: 3,
    cases: [c(["()"], true), c(["()[]{}"], true), c(["(]"], false), c(["([)]"], false), c(["{[]}"], true), c(["("], false), c(["]"], false), c([""], true)],
    complexity: "O(n) time, O(n) space (the stack)",
    ref: `function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch in pairs) { if (stack.pop() !== pairs[ch]) return false; }
    else stack.push(ch);
  }
  return stack.length === 0;
}`,
  },

  // ---------------- Arrays & Hashing ----------------
  {
    id: "contains-duplicate",
    title: "Contains Duplicate",
    difficulty: "Easy",
    pattern: "hashing",
    requires: HASH,
    leetcode: lc(217, "contains-duplicate", "Contains Duplicate"),
    fn: "containsDuplicate",
    params: ["nums"],
    statement: "Return `true` if any number appears at least twice in `nums`, and `false` if every number is different.\n\nCan you do it in one pass through the array?",
    examples: 2,
    cases: [c([[1, 2, 3, 1]], true), c([[1, 2, 3, 4]], false), c([[]], false), c([[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], true), c([[5]], false)],
    complexity: "O(n) time, O(n) space with a Set",
    ref: `function containsDuplicate(nums) {
  const seen = new Set();
  for (const n of nums) { if (seen.has(n)) return true; seen.add(n); }
  return false;
}`,
  },
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    pattern: "hashing",
    requires: HASH,
    leetcode: lc(1, "two-sum", "Two Sum"),
    fn: "twoSum",
    params: ["nums", "target"],
    statement:
      "Return the **indexes** of the two numbers in `nums` that add up to `target`. There is always exactly one answer, and you may not use the same element twice. Return them in any order.\n\nThe famous first LeetCode problem. Two loops work, but interviewers want **one** pass: O(n).",
    examples: 3,
    compare: "unordered",
    cases: [c([[2, 7, 11, 15], 9], [0, 1]), c([[3, 2, 4], 6], [1, 2]), c([[3, 3], 6], [0, 1]), c([[-1, -2, -3, -4, -5], -8], [2, 4]), c([[0, 4, 3, 0], 0], [0, 3])],
    complexity: "O(n) time, O(n) space with a Map",
    ref: `function twoSum(nums, target) {
  const index = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (index.has(target - nums[i])) return [index.get(target - nums[i]), i];
    index.set(nums[i], i);
  }
}`,
  },
  {
    id: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    pattern: "hashing",
    requires: [...HASH, "string"],
    leetcode: lc(242, "valid-anagram", "Valid Anagram"),
    fn: "isAnagram",
    params: ["s", "t"],
    statement: "Return `true` if `t` uses exactly the same letters as `s`, the same number of times each (like `\"listen\"` and `\"silent\"`).",
    examples: 2,
    cases: [c(["anagram", "nagaram"], true), c(["rat", "car"], false), c(["a", "ab"], false), c(["", ""], true), c(["aacc", "ccac"], false)],
    complexity: "O(n) time, O(1) space (26 letters) with counting",
    ref: `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of t) { if (!count[ch]) return false; count[ch]--; }
  return true;
}`,
  },
  {
    id: "majority-element",
    title: "Majority Element",
    difficulty: "Easy",
    pattern: "hashing",
    requires: HASH,
    leetcode: lc(169, "majority-element", "Majority Element"),
    fn: "majorityElement",
    params: ["nums"],
    statement: "One number appears **more than half** of the time in `nums`. Return it.\n\nBonus: can you do it with O(1) extra space?",
    examples: 2,
    cases: [c([[3, 2, 3]], 3), c([[2, 2, 1, 1, 1, 2, 2]], 2), c([[1]], 1), c([[6, 5, 5]], 5)],
    complexity: "O(n) time, O(1) space with Boyer–Moore voting",
    ref: `function majorityElement(nums) {
  let candidate = null, votes = 0;
  for (const n of nums) {
    if (votes === 0) candidate = n;
    votes += n === candidate ? 1 : -1;
  }
  return candidate;
}`,
  },
  {
    id: "missing-number",
    title: "Missing Number",
    difficulty: "Easy",
    pattern: "hashing",
    requires: ARR,
    leetcode: lc(268, "missing-number", "Missing Number"),
    fn: "missingNumber",
    params: ["nums"],
    statement: "`nums` contains `n` different numbers taken from `0, 1, 2, …, n`. Exactly one number in that range is missing. Return it.",
    examples: 2,
    cases: [c([[3, 0, 1]], 2), c([[0, 1]], 2), c([[9, 6, 4, 2, 3, 5, 7, 0, 1]], 8), c([[1]], 0)],
    complexity: "O(n) time, O(1) space (expected sum minus actual sum)",
    ref: `function missingNumber(nums) {
  const n = nums.length;
  let sum = (n * (n + 1)) / 2;
  for (const x of nums) sum -= x;
  return sum;
}`,
  },
  {
    id: "single-number",
    title: "Single Number",
    difficulty: "Easy",
    pattern: "hashing",
    requires: HASH,
    leetcode: lc(136, "single-number", "Single Number"),
    fn: "singleNumber",
    params: ["nums"],
    statement: "Every number in `nums` appears twice, except one. Return that one.\n\nEasy with extra memory. Can you do it with O(1) extra space? (Look up what the `^` operator does.)",
    examples: 2,
    cases: [c([[2, 2, 1]], 1), c([[4, 1, 2, 1, 2]], 4), c([[1]], 1), c([[-3, 7, 7]], -3)],
    complexity: "O(n) time, O(1) space with XOR",
    ref: `function singleNumber(nums) {
  let x = 0;
  for (const n of nums) x ^= n;
  return x;
}`,
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    pattern: "hashing",
    requires: [...HASH, "array-methods", "string"],
    leetcode: lc(49, "group-anagrams", "Group Anagrams"),
    fn: "groupAnagrams",
    params: ["strs"],
    statement: "Group the words that are anagrams of each other. Return an array of groups, in any order (the words inside a group can be in any order too).",
    examples: 2,
    compare: "unorderedDeep",
    cases: [
      c([["eat", "tea", "tan", "ate", "nat", "bat"]], [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]),
      c([[""]], [[""]]),
      c([["a"]], [["a"]]),
      c([["abc", "bca", "xyz", "zyx", "q"]], [["abc", "bca"], ["xyz", "zyx"], ["q"]]),
    ],
    complexity: "O(n · k log k) time (sorting each word of length k), O(n · k) space",
    ref: `function groupAnagrams(strs) {
  const groups = new Map();
  for (const s of strs) {
    const key = [...s].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()];
}`,
  },
  {
    id: "top-k-frequent",
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    pattern: "hashing",
    requires: [...HASH, "array-methods"],
    leetcode: lc(347, "top-k-frequent-elements", "Top K Frequent Elements"),
    fn: "topKFrequent",
    params: ["nums", "k"],
    statement: "Return the `k` numbers that appear most often in `nums`, in any order. The answer is always unique.\n\nSorting works in O(n log n). Can you beat that?",
    examples: 2,
    compare: "unordered",
    cases: [c([[1, 1, 1, 2, 2, 3], 2], [1, 2]), c([[1], 1], [1]), c([[4, 4, 4, 6, 6, 7, 7, 7, 7], 2], [7, 4]), c([[5, 3, 5, 3, 5, 9], 1], [5])],
    complexity: "O(n) time with bucket sort, O(n) space",
    ref: `function topKFrequent(nums, k) {
  const count = new Map();
  for (const n of nums) count.set(n, (count.get(n) || 0) + 1);
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [n, c] of count) buckets[c].push(n);
  const out = [];
  for (let i = buckets.length - 1; i >= 0 && out.length < k; i--) out.push(...buckets[i]);
  return out.slice(0, k);
}`,
  },
  {
    id: "product-except-self",
    title: "Product of Array Except Self",
    difficulty: "Medium",
    pattern: "hashing",
    requires: ARR,
    leetcode: lc(238, "product-of-array-except-self", "Product of Array Except Self"),
    fn: "productExceptSelf",
    params: ["nums"],
    statement:
      "Return an array where position `i` holds the product of every number in `nums` **except** `nums[i]`.\n\nRule: you may **not** use division, and it must be O(n).",
    examples: 2,
    cases: [c([[1, 2, 3, 4]], [24, 12, 8, 6]), c([[-1, 1, 0, -3, 3]], [0, 0, 9, 0, 0]), c([[2, 3]], [3, 2]), c([[5, 1, 1]], [1, 5, 5])],
    complexity: "O(n) time, O(1) extra space (besides the answer)",
    ref: `function productExceptSelf(nums) {
  const out = new Array(nums.length).fill(1);
  let left = 1;
  for (let i = 0; i < nums.length; i++) { out[i] = left; left *= nums[i]; }
  let right = 1;
  for (let i = nums.length - 1; i >= 0; i--) { out[i] *= right; right *= nums[i]; }
  return out.map((x) => (Object.is(x, -0) ? 0 : x));
}`,
  },
  {
    id: "longest-consecutive",
    title: "Longest Consecutive Sequence",
    difficulty: "Medium",
    pattern: "hashing",
    requires: HASH,
    leetcode: lc(128, "longest-consecutive-sequence", "Longest Consecutive Sequence"),
    fn: "longestConsecutive",
    params: ["nums"],
    statement: "Return the length of the longest run of consecutive numbers (like 1, 2, 3, 4) that can be made from the numbers in `nums`, in any order.\n\nIt must run in O(n): sorting is not allowed.",
    examples: 2,
    cases: [c([[100, 4, 200, 1, 3, 2]], 4), c([[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], 9), c([[]], 0), c([[1, 2, 0, 1]], 3), c([[9]], 1)],
    complexity: "O(n) time, O(n) space with a Set",
    ref: `function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const n of set) {
    if (set.has(n - 1)) continue;
    let len = 1;
    while (set.has(n + len)) len++;
    best = Math.max(best, len);
  }
  return best;
}`,
  },

  // ---------------- Two Pointers ----------------
  {
    id: "move-zeroes",
    title: "Move Zeroes",
    difficulty: "Easy",
    pattern: "two-pointers",
    requires: ARR,
    leetcode: lc(283, "move-zeroes", "Move Zeroes"),
    fn: "moveZeroes",
    params: ["nums"],
    statement: "Move all `0`s to the end of `nums`, keeping the order of the other numbers. Change the array **in place** (no new array), then return it.",
    examples: 2,
    cases: [c([[0, 1, 0, 3, 12]], [1, 3, 12, 0, 0]), c([[0]], [0]), c([[1, 2]], [1, 2]), c([[0, 0, 1]], [1, 0, 0])],
    complexity: "O(n) time, O(1) space",
    ref: `function moveZeroes(nums) {
  let w = 0;
  for (let r = 0; r < nums.length; r++) if (nums[r] !== 0) [nums[w++], nums[r]] = [nums[r], nums[w]];
  return nums;
}`,
  },
  {
    id: "two-sum-sorted",
    title: "Two Sum II (sorted input)",
    difficulty: "Medium",
    pattern: "two-pointers",
    requires: ARR,
    leetcode: lc(167, "two-sum-ii-input-array-is-sorted", "Two Sum II - Input Array Is Sorted"),
    fn: "twoSumSorted",
    params: ["numbers", "target"],
    statement:
      "`numbers` is sorted from small to big. Find the two numbers that add up to `target` and return their positions **counting from 1**, smaller first. There is exactly one answer.\n\nUse only O(1) extra space: no Map this time.",
    examples: 2,
    cases: [c([[2, 7, 11, 15], 9], [1, 2]), c([[2, 3, 4], 6], [1, 3]), c([[-1, 0], -1], [1, 2]), c([[1, 2, 3, 4, 4, 9, 56, 90], 8], [4, 5])],
    complexity: "O(n) time, O(1) space",
    ref: `function twoSumSorted(numbers, target) {
  let i = 0, j = numbers.length - 1;
  while (i < j) {
    const sum = numbers[i] + numbers[j];
    if (sum === target) return [i + 1, j + 1];
    if (sum < target) i++; else j--;
  }
}`,
  },
  {
    id: "three-sum",
    title: "3Sum",
    difficulty: "Medium",
    pattern: "two-pointers",
    requires: ARRM,
    leetcode: lc(15, "3sum", "3Sum"),
    fn: "threeSum",
    params: ["nums"],
    statement:
      "Return every **different** group of three numbers from `nums` that add up to 0. Each group is an array of three numbers. No repeated groups. Order doesn't matter.\n\nThe slow way is O(n³). Get it to O(n²).",
    examples: 2,
    compare: "unorderedDeep",
    cases: [c([[-1, 0, 1, 2, -1, -4]], [[-1, -1, 2], [-1, 0, 1]]), c([[0, 1, 1]], []), c([[0, 0, 0]], [[0, 0, 0]]), c([[0, 0, 0, 0]], [[0, 0, 0]]), c([[-2, 0, 1, 1, 2]], [[-2, 0, 2], [-2, 1, 1]])],
    complexity: "O(n²) time, O(1) extra space (besides sorting and the answer)",
    ref: `function threeSum(nums) {
  nums = [...nums].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    let j = i + 1, k = nums.length - 1;
    while (j < k) {
      const s = nums[i] + nums[j] + nums[k];
      if (s < 0) j++;
      else if (s > 0) k--;
      else {
        out.push([nums[i], nums[j], nums[k]]);
        while (j < k && nums[j] === nums[j + 1]) j++;
        j++; k--;
      }
    }
  }
  return out;
}`,
  },
  {
    id: "container-water",
    title: "Container With Most Water",
    difficulty: "Medium",
    pattern: "two-pointers",
    requires: ARR,
    leetcode: lc(11, "container-with-most-water", "Container With Most Water"),
    fn: "maxArea",
    params: ["height"],
    statement:
      "`height[i]` is the height of a wall at position `i`. Pick two walls: together with the floor they hold water. The amount is `(distance between them) × (height of the shorter wall)`. Return the most water any two walls can hold.",
    examples: 2,
    cases: [c([[1, 8, 6, 2, 5, 4, 8, 3, 7]], 49), c([[1, 1]], 1), c([[4, 3, 2, 1, 4]], 16), c([[1, 2, 1]], 2)],
    complexity: "O(n) time, O(1) space",
    ref: `function maxArea(height) {
  let i = 0, j = height.length - 1, best = 0;
  while (i < j) {
    best = Math.max(best, (j - i) * Math.min(height[i], height[j]));
    if (height[i] < height[j]) i++; else j--;
  }
  return best;
}`,
  },
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    pattern: "two-pointers",
    requires: ARR,
    leetcode: lc(42, "trapping-rain-water", "Trapping Rain Water"),
    fn: "trap",
    params: ["height"],
    statement:
      "`height` describes a row of bars (each 1 wide). After rain, water fills the dips between bars. Return how many units of water are trapped.\n\nKey idea: the water above a bar depends on the tallest bar to its left and the tallest to its right.",
    examples: 2,
    cases: [c([[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], 6), c([[4, 2, 0, 3, 2, 5]], 9), c([[]], 0), c([[3, 0, 3]], 3), c([[1, 2, 3]], 0)],
    complexity: "O(n) time, O(1) space with two pointers",
    ref: `function trap(height) {
  let i = 0, j = height.length - 1, leftMax = 0, rightMax = 0, water = 0;
  while (i < j) {
    if (height[i] < height[j]) {
      leftMax = Math.max(leftMax, height[i]);
      water += leftMax - height[i]; i++;
    } else {
      rightMax = Math.max(rightMax, height[j]);
      water += rightMax - height[j]; j--;
    }
  }
  return water;
}`,
  },

  // ---------------- Sliding Window ----------------
  {
    id: "best-time-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    pattern: "sliding-window",
    requires: ARR,
    leetcode: lc(121, "best-time-to-buy-and-sell-stock", "Best Time to Buy and Sell Stock"),
    fn: "maxProfit",
    params: ["prices"],
    statement: "`prices[i]` is a stock's price on day `i`. Buy on one day and sell on a **later** day. Return the biggest profit you can make, or 0 if you can't make any.",
    examples: 2,
    cases: [c([[7, 1, 5, 3, 6, 4]], 5), c([[7, 6, 4, 3, 1]], 0), c([[1, 2]], 1), c([[2, 4, 1]], 2), c([[3]], 0)],
    complexity: "O(n) time, O(1) space",
    ref: `function maxProfit(prices) {
  let low = Infinity, best = 0;
  for (const p of prices) { low = Math.min(low, p); best = Math.max(best, p - low); }
  return best;
}`,
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    pattern: "sliding-window",
    requires: [...STR, "map-set"],
    leetcode: lc(3, "longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters"),
    fn: "lengthOfLongestSubstring",
    params: ["s"],
    statement: "Return the length of the longest piece of `s` (characters next to each other) in which no character repeats.",
    examples: 3,
    cases: [c(["abcabcbb"], 3), c(["bbbbb"], 1), c(["pwwkew"], 3), c([""], 0), c([" "], 1), c(["dvdf"], 3), c(["abba"], 2)],
    complexity: "O(n) time, O(alphabet) space",
    ref: `function lengthOfLongestSubstring(s) {
  const last = new Map();
  let start = 0, best = 0;
  for (let i = 0; i < s.length; i++) {
    if (last.has(s[i]) && last.get(s[i]) >= start) start = last.get(s[i]) + 1;
    last.set(s[i], i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}`,
  },
  {
    id: "char-replacement",
    title: "Longest Repeating Character Replacement",
    difficulty: "Medium",
    pattern: "sliding-window",
    requires: [...STR, "map-set", "object"],
    leetcode: lc(424, "longest-repeating-character-replacement", "Longest Repeating Character Replacement"),
    fn: "characterReplacement",
    params: ["s", "k"],
    statement: "`s` has only capital letters. You may change at most `k` letters into any other letter. Return the length of the longest piece of `s` that can be made of one repeated letter.",
    examples: 2,
    cases: [c(["ABAB", 2], 4), c(["AABABBA", 1], 4), c(["A", 0], 1), c(["AAAA", 0], 4), c(["ABCDE", 1], 2)],
    complexity: "O(n) time, O(26) space",
    ref: `function characterReplacement(s, k) {
  const count = {};
  let start = 0, maxCount = 0, best = 0;
  for (let i = 0; i < s.length; i++) {
    count[s[i]] = (count[s[i]] || 0) + 1;
    maxCount = Math.max(maxCount, count[s[i]]);
    while (i - start + 1 - maxCount > k) { count[s[start]]--; start++; }
    best = Math.max(best, i - start + 1);
  }
  return best;
}`,
  },
  {
    id: "min-window",
    title: "Minimum Window Substring",
    difficulty: "Hard",
    pattern: "sliding-window",
    requires: [...STR, "map-set", "object"],
    leetcode: lc(76, "minimum-window-substring", "Minimum Window Substring"),
    fn: "minWindow",
    params: ["s", "t"],
    statement:
      "Return the **shortest** piece of `s` that contains every character of `t` (including repeats). If there is none, return `\"\"`. The answer is always unique.",
    examples: 3,
    cases: [c(["ADOBECODEBANC", "ABC"], "BANC"), c(["a", "a"], "a"), c(["a", "aa"], ""), c(["ab", "b"], "b"), c(["aaflslflsldkalskaaa", "aaa"], "aaa")],
    complexity: "O(|s| + |t|) time, O(alphabet) space",
    ref: `function minWindow(s, t) {
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);
  let missing = t.length, start = 0, bestStart = 0, bestLen = Infinity;
  for (let i = 0; i < s.length; i++) {
    if (need.has(s[i])) { if (need.get(s[i]) > 0) missing--; need.set(s[i], need.get(s[i]) - 1); }
    while (missing === 0) {
      if (i - start + 1 < bestLen) { bestLen = i - start + 1; bestStart = start; }
      if (need.has(s[start])) { need.set(s[start], need.get(s[start]) + 1); if (need.get(s[start]) > 0) missing++; }
      start++;
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
}`,
  },

  // ---------------- Stack ----------------
  {
    id: "eval-rpn",
    title: "Evaluate Reverse Polish Notation",
    difficulty: "Medium",
    pattern: "stack",
    requires: [...ARR, "string"],
    leetcode: lc(150, "evaluate-reverse-polish-notation", "Evaluate Reverse Polish Notation"),
    fn: "evalRPN",
    params: ["tokens"],
    statement:
      "In Reverse Polish Notation the operator comes after its two numbers: `[\"2\",\"1\",\"+\",\"3\",\"*\"]` means `(2 + 1) * 3 = 9`. Evaluate `tokens` and return the number. Operators are `+ - * /`; division cuts off the decimals toward zero (`7 / -2` is `-3`).",
    examples: 2,
    cases: [c([["2", "1", "+", "3", "*"]], 9), c([["4", "13", "5", "/", "+"]], 6), c([["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]], 22), c([["7", "-2", "/"]], -3), c([["5"]], 5)],
    complexity: "O(n) time, O(n) space",
    ref: `function evalRPN(tokens) {
  const st = [];
  for (const t of tokens) {
    if (["+", "-", "*", "/"].includes(t)) {
      const b = st.pop(), a = st.pop();
      st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
    } else st.push(Number(t));
  }
  return st[0];
}`,
  },
  {
    id: "daily-temperatures",
    title: "Daily Temperatures",
    difficulty: "Medium",
    pattern: "stack",
    requires: ARR,
    leetcode: lc(739, "daily-temperatures", "Daily Temperatures"),
    fn: "dailyTemperatures",
    params: ["temps"],
    statement: "For each day, return how many days you must wait for a **warmer** day. If none comes, put 0. Must be O(n): checking every later day for every day is too slow.",
    examples: 2,
    cases: [c([[73, 74, 75, 71, 69, 72, 76, 73]], [1, 1, 4, 2, 1, 1, 0, 0]), c([[30, 40, 50, 60]], [1, 1, 1, 0]), c([[30, 60, 90]], [1, 1, 0]), c([[90, 80, 70]], [0, 0, 0])],
    complexity: "O(n) time, O(n) space",
    ref: `function dailyTemperatures(temps) {
  const out = new Array(temps.length).fill(0), st = [];
  for (let i = 0; i < temps.length; i++) {
    while (st.length && temps[st[st.length - 1]] < temps[i]) { const j = st.pop(); out[j] = i - j; }
    st.push(i);
  }
  return out;
}`,
  },
  {
    id: "largest-rectangle",
    title: "Largest Rectangle in Histogram",
    difficulty: "Hard",
    pattern: "stack",
    requires: ARR,
    leetcode: lc(84, "largest-rectangle-in-histogram", "Largest Rectangle in Histogram"),
    fn: "largestRectangleArea",
    params: ["heights"],
    statement: "`heights` describes bars of width 1 standing next to each other. Return the area of the largest rectangle that fits completely inside the bars.",
    examples: 2,
    cases: [c([[2, 1, 5, 6, 2, 3]], 10), c([[2, 4]], 4), c([[1]], 1), c([[2, 2, 2]], 6), c([[6, 2, 5, 4, 5, 1, 6]], 12)],
    complexity: "O(n) time, O(n) space with a monotonic stack",
    ref: `function largestRectangleArea(heights) {
  const st = []; let best = 0;
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (st.length && heights[st[st.length - 1]] >= h) {
      const top = heights[st.pop()];
      const left = st.length ? st[st.length - 1] + 1 : 0;
      best = Math.max(best, top * (i - left));
    }
    st.push(i);
  }
  return best;
}`,
  },

  // ---------------- Binary Search ----------------
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(704, "binary-search", "Binary Search"),
    fn: "search",
    params: ["nums", "target"],
    statement: "`nums` is sorted. Return the index of `target`, or `-1` if it isn't there. It must be O(log n): don't check every element.",
    examples: 2,
    cases: [c([[-1, 0, 3, 5, 9, 12], 9], 4), c([[-1, 0, 3, 5, 9, 12], 2], -1), c([[5], 5], 0), c([[1, 3], 3], 1), c([[1, 3], 0], -1)],
    complexity: "O(log n) time, O(1) space",
    ref: `function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}`,
  },
  {
    id: "search-matrix",
    title: "Search a 2D Matrix",
    difficulty: "Medium",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(74, "search-a-2d-matrix", "Search a 2D Matrix"),
    fn: "searchMatrix",
    params: ["matrix", "target"],
    statement: "Each row of `matrix` is sorted, and each row starts with a number bigger than the end of the row before. Return `true` if `target` is in the matrix. Aim for O(log(rows × columns)).",
    examples: 2,
    cases: [c([[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 3], true), c([[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 13], false), c([[[1]], 1], true), c([[[1, 3]], 3], true), c([[[1], [3]], 2], false)],
    complexity: "O(log(m·n)) time, O(1) space",
    ref: `function searchMatrix(matrix, target) {
  const cols = matrix[0].length;
  let lo = 0, hi = matrix.length * cols - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, v = matrix[Math.floor(mid / cols)][mid % cols];
    if (v === target) return true;
    if (v < target) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}`,
  },
  {
    id: "min-rotated",
    title: "Find Minimum in Rotated Sorted Array",
    difficulty: "Medium",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(153, "find-minimum-in-rotated-sorted-array", "Find Minimum in Rotated Sorted Array"),
    fn: "findMin",
    params: ["nums"],
    statement: "A sorted array of different numbers was rotated: `[0,1,2,4,5,6,7]` might become `[4,5,6,7,0,1,2]`. Return the smallest number in O(log n).",
    examples: 2,
    cases: [c([[3, 4, 5, 1, 2]], 1), c([[4, 5, 6, 7, 0, 1, 2]], 0), c([[11, 13, 15, 17]], 11), c([[2, 1]], 1), c([[1]], 1)],
    complexity: "O(log n) time, O(1) space",
    ref: `function findMin(nums) {
  let lo = 0, hi = nums.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] > nums[hi]) lo = mid + 1; else hi = mid;
  }
  return nums[lo];
}`,
  },
  {
    id: "search-rotated",
    title: "Search in Rotated Sorted Array",
    difficulty: "Medium",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(33, "search-in-rotated-sorted-array", "Search in Rotated Sorted Array"),
    fn: "searchRotated",
    params: ["nums", "target"],
    statement: "`nums` is a rotated sorted array of different numbers (see the previous problem). Return the index of `target` or `-1`, in O(log n).",
    examples: 2,
    cases: [c([[4, 5, 6, 7, 0, 1, 2], 0], 4), c([[4, 5, 6, 7, 0, 1, 2], 3], -1), c([[1], 0], -1), c([[3, 1], 1], 1), c([[5, 1, 3], 5], 0)],
    complexity: "O(log n) time, O(1) space",
    ref: `function searchRotated(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1; else lo = mid + 1;
    } else {
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1; else hi = mid - 1;
    }
  }
  return -1;
}`,
  },
  {
    id: "koko-bananas",
    title: "Koko Eating Bananas",
    difficulty: "Medium",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(875, "koko-eating-bananas", "Koko Eating Bananas"),
    fn: "minEatingSpeed",
    params: ["piles", "h"],
    statement:
      "Koko has piles of bananas (`piles[i]` bananas in pile `i`) and `h` hours. Each hour she picks one pile and eats up to `k` bananas from it (if the pile has fewer, she finishes it and waits). Return the **smallest** `k` that lets her finish everything within `h` hours.\n\nThis is binary search on the *answer*, not on the array.",
    examples: 2,
    cases: [c([[3, 6, 7, 11], 8], 4), c([[30, 11, 23, 4, 20], 5], 30), c([[30, 11, 23, 4, 20], 6], 23), c([[1], 1], 1), c([[312884470], 312884469], 2)],
    complexity: "O(n log(max pile)) time, O(1) space",
    ref: `function minEatingSpeed(piles, h) {
  let lo = 1, hi = Math.max(...piles);
  while (lo < hi) {
    const k = Math.floor((lo + hi) / 2);
    let hours = 0;
    for (const p of piles) hours += Math.ceil(p / k);
    if (hours <= h) hi = k; else lo = k + 1;
  }
  return lo;
}`,
  },

  // ---------------- Linked List ----------------
  {
    id: "reverse-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    pattern: "linked-list",
    requires: REC,
    leetcode: lc(206, "reverse-linked-list", "Reverse Linked List"),
    fn: "reverseList",
    params: ["head"],
    argShapes: ["list"],
    returns: "list",
    statement:
      "A linked list is a chain of nodes like `{ val: 1, next: { val: 2, next: null } }`. You get the first node, `head`. Reverse the list and return the new first node.\n\n(The tests write lists as arrays like `[1,2,3]` and turn them into nodes for you.)",
    examples: 2,
    cases: [c([[1, 2, 3, 4, 5]], [5, 4, 3, 2, 1]), c([[1, 2]], [2, 1]), c([[]], []), c([[7]], [7])],
    complexity: "O(n) time, O(1) space iteratively",
    ref: `function reverseList(head) {
  let prev = null;
  while (head) { const next = head.next; head.next = prev; prev = head; head = next; }
  return prev;
}`,
  },
  {
    id: "merge-sorted-lists",
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    pattern: "linked-list",
    requires: REC,
    leetcode: lc(21, "merge-two-sorted-lists", "Merge Two Sorted Lists"),
    fn: "mergeTwoLists",
    params: ["list1", "list2"],
    argShapes: ["list", "list"],
    returns: "list",
    statement: "Both linked lists are sorted. Merge them into one sorted list (reuse the nodes) and return its first node.",
    examples: 2,
    cases: [c([[1, 2, 4], [1, 3, 4]], [1, 1, 2, 3, 4, 4]), c([[], []], []), c([[], [0]], [0]), c([[5], [1, 2, 3]], [1, 2, 3, 5])],
    complexity: "O(n + m) time, O(1) space",
    ref: `function mergeTwoLists(list1, list2) {
  const dummy = { val: 0, next: null };
  let tail = dummy;
  while (list1 && list2) {
    if (list1.val <= list2.val) { tail.next = list1; list1 = list1.next; }
    else { tail.next = list2; list2 = list2.next; }
    tail = tail.next;
  }
  tail.next = list1 || list2;
  return dummy.next;
}`,
  },
  {
    id: "middle-node",
    title: "Middle of the Linked List",
    difficulty: "Easy",
    pattern: "linked-list",
    requires: REC,
    leetcode: lc(876, "middle-of-the-linked-list", "Middle of the Linked List"),
    fn: "middleNode",
    params: ["head"],
    argShapes: ["list"],
    returns: "list",
    statement: "Return the middle node of the list (if there are two middles, the second one). Can you do it in one pass, without counting the nodes first?",
    examples: 2,
    cases: [c([[1, 2, 3, 4, 5]], [3, 4, 5]), c([[1, 2, 3, 4, 5, 6]], [4, 5, 6]), c([[1]], [1]), c([[1, 2]], [2])],
    complexity: "O(n) time, O(1) space",
    ref: `function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  return slow;
}`,
  },
  {
    id: "remove-nth",
    title: "Remove Nth Node From End",
    difficulty: "Medium",
    pattern: "linked-list",
    requires: REC,
    leetcode: lc(19, "remove-nth-node-from-end-of-list", "Remove Nth Node From End of List"),
    fn: "removeNthFromEnd",
    params: ["head", "n"],
    argShapes: ["list", "value"],
    returns: "list",
    statement: "Remove the `n`-th node counting from the **end** of the list and return the head. Can you do it in one pass?",
    examples: 2,
    cases: [c([[1, 2, 3, 4, 5], 2], [1, 2, 3, 5]), c([[1], 1], []), c([[1, 2], 1], [1]), c([[1, 2], 2], [2])],
    complexity: "O(n) time, O(1) space",
    ref: `function removeNthFromEnd(head, n) {
  const dummy = { val: 0, next: head };
  let fast = dummy, slow = dummy;
  for (let i = 0; i <= n; i++) fast = fast.next;
  while (fast) { fast = fast.next; slow = slow.next; }
  slow.next = slow.next.next;
  return dummy.next;
}`,
  },

  // ---------------- Trees ----------------
  {
    id: "max-depth",
    title: "Maximum Depth of Binary Tree",
    difficulty: "Easy",
    pattern: "trees",
    requires: REC,
    leetcode: lc(104, "maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree"),
    fn: "maxDepth",
    params: ["root"],
    argShapes: ["tree"],
    statement:
      "A binary tree node looks like `{ val: 3, left: node or null, right: node or null }`. Return the tree's depth: the number of nodes on the longest path from the root down to a leaf.\n\n(Tests write trees level by level as arrays, like `[3,9,20,null,null,15,7]`, and build the nodes for you.)",
    examples: 2,
    cases: [c([[3, 9, 20, null, null, 15, 7]], 3), c([[1, null, 2]], 2), c([[]], 0), c([[1, 2, 3, 4]], 3)],
    complexity: "O(n) time, O(height) space for the recursion",
    ref: `function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
  },
  {
    id: "invert-tree",
    title: "Invert Binary Tree",
    difficulty: "Easy",
    pattern: "trees",
    requires: REC,
    leetcode: lc(226, "invert-binary-tree", "Invert Binary Tree"),
    fn: "invertTree",
    params: ["root"],
    argShapes: ["tree"],
    returns: "tree",
    statement: "Mirror the tree: swap the left and right child of **every** node. Return the root. (A famous tweet said a top engineer failed a Google interview on this one!)",
    examples: 2,
    cases: [c([[4, 2, 7, 1, 3, 6, 9]], [4, 7, 2, 9, 6, 3, 1]), c([[2, 1, 3]], [2, 3, 1]), c([[]], []), c([[1, 2]], [1, null, 2])],
    complexity: "O(n) time, O(height) space",
    ref: `function invertTree(root) {
  if (!root) return null;
  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];
  return root;
}`,
  },
  {
    id: "same-tree",
    title: "Same Tree",
    difficulty: "Easy",
    pattern: "trees",
    requires: REC,
    leetcode: lc(100, "same-tree", "Same Tree"),
    fn: "isSameTree",
    params: ["p", "q"],
    argShapes: ["tree", "tree"],
    statement: "Return `true` if the two trees have exactly the same shape and the same values in the same places.",
    examples: 2,
    cases: [c([[1, 2, 3], [1, 2, 3]], true), c([[1, 2], [1, null, 2]], false), c([[1, 2, 1], [1, 1, 2]], false), c([[], []], true)],
    complexity: "O(n) time, O(height) space",
    ref: `function isSameTree(p, q) {
  if (!p || !q) return p === q;
  return p.val === q.val && isSameTree(p.left, q.left) && isSameTree(p.right, q.right);
}`,
  },
  {
    id: "level-order",
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    pattern: "trees",
    requires: REC,
    leetcode: lc(102, "binary-tree-level-order-traversal", "Binary Tree Level Order Traversal"),
    fn: "levelOrder",
    params: ["root"],
    argShapes: ["tree"],
    statement: "Return the values level by level, from top to bottom and left to right: an array of arrays, one per level. This is *breadth-first search* (BFS) with a queue.",
    examples: 2,
    cases: [c([[3, 9, 20, null, null, 15, 7]], [[3], [9, 20], [15, 7]]), c([[1]], [[1]]), c([[]], []), c([[1, 2, 3, 4, null, null, 5]], [[1], [2, 3], [4, 5]])],
    complexity: "O(n) time, O(n) space",
    ref: `function levelOrder(root) {
  const out = [];
  let level = root ? [root] : [];
  while (level.length) {
    out.push(level.map((n) => n.val));
    level = level.flatMap((n) => [n.left, n.right].filter(Boolean));
  }
  return out;
}`,
  },
  {
    id: "valid-bst",
    title: "Validate Binary Search Tree",
    difficulty: "Medium",
    pattern: "trees",
    requires: REC,
    leetcode: lc(98, "validate-binary-search-tree", "Validate Binary Search Tree"),
    fn: "isValidBST",
    params: ["root"],
    argShapes: ["tree"],
    statement:
      "In a binary *search* tree, every value in a node's left side is smaller than the node, and every value in its right side is bigger, at every level. Return `true` if the tree follows this rule.\n\nTrap: checking only each node's direct children is not enough.",
    examples: 2,
    cases: [c([[2, 1, 3]], true), c([[5, 1, 4, null, null, 3, 6]], false), c([[5, 4, 6, null, null, 3, 7]], false), c([[1]], true), c([[2, 2, 2]], false)],
    complexity: "O(n) time, O(height) space",
    ref: `function isValidBST(root, lo = -Infinity, hi = Infinity) {
  if (!root) return true;
  if (root.val <= lo || root.val >= hi) return false;
  return isValidBST(root.left, lo, root.val) && isValidBST(root.right, root.val, hi);
}`,
  },

  // ---------------- Dynamic Programming ----------------
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    pattern: "dp",
    requires: BASICS,
    leetcode: lc(70, "climbing-stairs", "Climbing Stairs"),
    fn: "climbStairs",
    params: ["n"],
    statement: "You climb a staircase with `n` steps, taking 1 or 2 steps at a time. In how many different ways can you reach the top?\n\nWrite the answers for n = 1, 2, 3, 4… on paper first. Do you see a pattern?",
    examples: 2,
    cases: [c([2], 2), c([3], 3), c([1], 1), c([5], 8), c([45], 1836311903)],
    complexity: "O(n) time, O(1) space",
    ref: `function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}`,
  },
  {
    id: "house-robber",
    title: "House Robber",
    difficulty: "Medium",
    pattern: "dp",
    requires: ARR,
    leetcode: lc(198, "house-robber", "House Robber"),
    fn: "rob",
    params: ["nums"],
    statement: "Houses on a street hold `nums[i]` money each. You can't take from two houses next to each other. Return the most money you can collect.",
    examples: 2,
    cases: [c([[1, 2, 3, 1]], 4), c([[2, 7, 9, 3, 1]], 12), c([[5]], 5), c([[2, 1, 1, 2]], 4), c([[0, 0]], 0)],
    complexity: "O(n) time, O(1) space",
    ref: `function rob(nums) {
  let skip = 0, take = 0;
  for (const n of nums) [skip, take] = [Math.max(skip, take), skip + n];
  return Math.max(skip, take);
}`,
  },
  {
    id: "coin-change",
    title: "Coin Change",
    difficulty: "Medium",
    pattern: "dp",
    requires: ARR,
    leetcode: lc(322, "coin-change", "Coin Change"),
    fn: "coinChange",
    params: ["coins", "amount"],
    statement: "Using coins of the values in `coins` (as many of each as you like), return the **fewest** coins that add up to `amount`, or `-1` if it's impossible.\n\nWatch out: always taking the biggest coin first does not always work!",
    examples: 3,
    cases: [c([[1, 2, 5], 11], 3), c([[2], 3], -1), c([[1], 0], 0), c([[1, 3, 4], 6], 2), c([[186, 419, 83, 408], 6249], 20)],
    complexity: "O(amount × coins) time, O(amount) space",
    ref: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++)
    for (const c of coins) if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
  return dp[amount] === Infinity ? -1 : dp[amount];
}`,
  },
  {
    id: "unique-paths",
    title: "Unique Paths",
    difficulty: "Medium",
    pattern: "dp",
    requires: ARR,
    leetcode: lc(62, "unique-paths", "Unique Paths"),
    fn: "uniquePaths",
    params: ["m", "n"],
    statement: "A robot starts at the top-left of an `m × n` grid and can only move right or down. How many different paths lead to the bottom-right corner?",
    examples: 2,
    cases: [c([3, 7], 28), c([3, 2], 3), c([1, 1], 1), c([10, 10], 48620)],
    complexity: "O(m × n) time, O(n) space",
    ref: `function uniquePaths(m, n) {
  const row = new Array(n).fill(1);
  for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) row[j] += row[j - 1];
  return row[n - 1];
}`,
  },
  {
    id: "lis",
    title: "Longest Increasing Subsequence",
    difficulty: "Medium",
    pattern: "dp",
    requires: ARR,
    leetcode: lc(300, "longest-increasing-subsequence", "Longest Increasing Subsequence"),
    fn: "lengthOfLIS",
    params: ["nums"],
    statement: "Return the length of the longest **strictly increasing** subsequence: numbers taken in order from `nums` (you can skip numbers), each bigger than the one before.",
    examples: 2,
    cases: [c([[10, 9, 2, 5, 3, 7, 101, 18]], 4), c([[0, 1, 0, 3, 2, 3]], 4), c([[7, 7, 7, 7]], 1), c([[1]], 1), c([[4, 10, 4, 3, 8, 9]], 3)],
    complexity: "O(n²) with DP, or O(n log n) with binary search",
    ref: `function lengthOfLIS(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
    tails[lo] = x;
  }
  return tails.length;
}`,
  },
  {
    id: "word-break",
    title: "Word Break",
    difficulty: "Medium",
    pattern: "dp",
    requires: [...ARR, "string", "map-set"],
    leetcode: lc(139, "word-break", "Word Break"),
    fn: "wordBreak",
    params: ["s", "wordDict"],
    statement: "Return `true` if `s` can be cut into pieces that are all words from `wordDict` (words can be reused).",
    examples: 2,
    cases: [c(["leetcode", ["leet", "code"]], true), c(["catsandog", ["cats", "dog", "sand", "and", "cat"]], false), c(["applepenapple", ["apple", "pen"]], true), c(["a", ["b"]], false)],
    complexity: "O(n² ) time (with a Set of words), O(n) space",
    ref: `function wordBreak(s, wordDict) {
  const words = new Set(wordDict);
  const ok = new Array(s.length + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= s.length; i++)
    for (let j = 0; j < i; j++) if (ok[j] && words.has(s.slice(j, i))) { ok[i] = true; break; }
  return ok[s.length];
}`,
  },

  // ---------------- Graphs ----------------
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    pattern: "graphs",
    requires: REC,
    leetcode: lc(200, "number-of-islands", "Number of Islands"),
    fn: "numIslands",
    params: ["grid"],
    statement: "`grid` is a map of `\"1\"` (land) and `\"0\"` (water). An island is land connected up, down, left or right. Return how many islands there are.",
    examples: 2,
    cases: [
      c([[["1", "1", "1", "1", "0"], ["1", "1", "0", "1", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "0", "0", "0"]]], 1),
      c([[["1", "1", "0", "0", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "1", "0", "0"], ["0", "0", "0", "1", "1"]]], 3),
      c([[["0"]]], 0),
      c([[["1", "0", "1"], ["0", "1", "0"], ["1", "0", "1"]]], 5),
    ],
    complexity: "O(rows × cols) time and space",
    ref: `function numIslands(grid) {
  const g = grid.map((r) => [...r]);
  let count = 0;
  const sink = (i, j) => {
    if (i < 0 || j < 0 || i >= g.length || j >= g[0].length || g[i][j] !== "1") return;
    g[i][j] = "0";
    sink(i + 1, j); sink(i - 1, j); sink(i, j + 1); sink(i, j - 1);
  };
  for (let i = 0; i < g.length; i++) for (let j = 0; j < g[0].length; j++) if (g[i][j] === "1") { count++; sink(i, j); }
  return count;
}`,
  },
  {
    id: "max-area-island",
    title: "Max Area of Island",
    difficulty: "Medium",
    pattern: "graphs",
    requires: REC,
    leetcode: lc(695, "max-area-of-island", "Max Area of Island"),
    fn: "maxAreaOfIsland",
    params: ["grid"],
    statement: "`grid` holds `1` (land) and `0` (water). Return the size (number of cells) of the biggest island, or 0 if there is none.",
    examples: 2,
    cases: [c([[[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 1]]], 4), c([[[0, 0, 0]]], 0), c([[[1, 1], [1, 1]]], 4), c([[[1, 0, 1], [0, 0, 0], [1, 1, 1]]], 3)],
    complexity: "O(rows × cols) time and space",
    ref: `function maxAreaOfIsland(grid) {
  const g = grid.map((r) => [...r]);
  const area = (i, j) => {
    if (i < 0 || j < 0 || i >= g.length || j >= g[0].length || g[i][j] !== 1) return 0;
    g[i][j] = 0;
    return 1 + area(i + 1, j) + area(i - 1, j) + area(i, j + 1) + area(i, j - 1);
  };
  let best = 0;
  for (let i = 0; i < g.length; i++) for (let j = 0; j < g[0].length; j++) best = Math.max(best, area(i, j));
  return best;
}`,
  },

  // ---------------- Backtracking ----------------
  {
    id: "subsets",
    title: "Subsets",
    difficulty: "Medium",
    pattern: "backtracking",
    requires: REC,
    leetcode: lc(78, "subsets", "Subsets"),
    fn: "subsets",
    params: ["nums"],
    statement: "Return every possible subset of `nums` (the numbers are all different), including the empty one. Any order.",
    examples: 2,
    compare: "unorderedDeep",
    cases: [c([[1, 2, 3]], [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]), c([[0]], [[], [0]]), c([[]], [[]])],
    complexity: "O(n · 2ⁿ) time and space",
    ref: `function subsets(nums) {
  const out = [];
  const go = (i, cur) => {
    if (i === nums.length) { out.push([...cur]); return; }
    go(i + 1, cur);
    cur.push(nums[i]); go(i + 1, cur); cur.pop();
  };
  go(0, []);
  return out;
}`,
  },
  {
    id: "permutations",
    title: "Permutations",
    difficulty: "Medium",
    pattern: "backtracking",
    requires: REC,
    leetcode: lc(46, "permutations", "Permutations"),
    fn: "permute",
    params: ["nums"],
    statement: "Return every possible ordering of `nums` (all different). Any order.",
    examples: 2,
    compare: "unordered",
    cases: [c([[1, 2, 3]], [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]), c([[0, 1]], [[0, 1], [1, 0]]), c([[1]], [[1]])],
    complexity: "O(n · n!) time and space",
    ref: `function permute(nums) {
  const out = [];
  const go = (cur, left) => {
    if (!left.length) { out.push(cur); return; }
    left.forEach((x, i) => go([...cur, x], [...left.slice(0, i), ...left.slice(i + 1)]));
  };
  go([], nums);
  return out;
}`,
  },
  {
    id: "combination-sum",
    title: "Combination Sum",
    difficulty: "Medium",
    pattern: "backtracking",
    requires: REC,
    leetcode: lc(39, "combination-sum", "Combination Sum"),
    fn: "combinationSum",
    params: ["candidates", "target"],
    statement: "Return every different combination of numbers from `candidates` that adds up to `target`. Each number may be used again and again. Combinations are different if they use different counts of some number. Any order.",
    examples: 2,
    compare: "unorderedDeep",
    cases: [c([[2, 3, 6, 7], 7], [[2, 2, 3], [7]]), c([[2, 3, 5], 8], [[2, 2, 2, 2], [2, 3, 3], [3, 5]]), c([[2], 1], [])],
    complexity: "Exponential: O(n^(target/min)) in the worst case",
    ref: `function combinationSum(candidates, target) {
  const out = [];
  const go = (start, left, cur) => {
    if (left === 0) { out.push([...cur]); return; }
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > left) continue;
      cur.push(candidates[i]); go(i, left - candidates[i], cur); cur.pop();
    }
  };
  go(0, target, []);
  return out;
}`,
  },
  {
    id: "generate-parentheses",
    title: "Generate Parentheses",
    difficulty: "Medium",
    pattern: "backtracking",
    requires: [...REC, "string"],
    leetcode: lc(22, "generate-parentheses", "Generate Parentheses"),
    fn: "generateParenthesis",
    params: ["n"],
    statement: "Return every string of `n` pairs of brackets `()` that is correctly matched. Any order.",
    examples: 2,
    compare: "unordered",
    cases: [c([3], ["((()))", "(()())", "(())()", "()(())", "()()()"]), c([1], ["()"]), c([2], ["(())", "()()"])],
    complexity: "O(4ⁿ / √n) time (the Catalan numbers)",
    ref: `function generateParenthesis(n) {
  const out = [];
  const go = (s, open, close) => {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) go(s + "(", open + 1, close);
    if (close < open) go(s + ")", open, close + 1);
  };
  go("", 0, 0);
  return out;
}`,
  },

  // ---------------- Intervals ----------------
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    pattern: "intervals",
    requires: ARRM,
    leetcode: lc(56, "merge-intervals", "Merge Intervals"),
    fn: "merge",
    params: ["intervals"],
    statement: "Each interval is `[start, end]`. Merge all intervals that overlap (touching counts, like `[1,4]` and `[4,5]`) and return the result sorted by start.",
    examples: 2,
    cases: [c([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]), c([[[1, 4], [4, 5]]], [[1, 5]]), c([[[4, 7], [1, 4]]], [[1, 7]]), c([[[1, 4], [2, 3]]], [[1, 4]])],
    complexity: "O(n log n) time for sorting, O(n) space",
    ref: `function merge(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    if (out.length && s <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
    else out.push([s, e]);
  }
  return out;
}`,
  },
  {
    id: "insert-interval",
    title: "Insert Interval",
    difficulty: "Medium",
    pattern: "intervals",
    requires: ARRM,
    leetcode: lc(57, "insert-interval", "Insert Interval"),
    fn: "insert",
    params: ["intervals", "newInterval"],
    statement: "`intervals` are sorted and don't overlap. Insert `newInterval`, merging where needed, and return the sorted, non-overlapping result.",
    examples: 2,
    cases: [c([[[1, 3], [6, 9]], [2, 5]], [[1, 5], [6, 9]]), c([[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], [[1, 2], [3, 10], [12, 16]]), c([[], [5, 7]], [[5, 7]]), c([[[1, 5]], [6, 8]], [[1, 5], [6, 8]])],
    complexity: "O(n) time, O(n) space",
    ref: `function insert(intervals, newInterval) {
  const out = [];
  let [s, e] = newInterval, i = 0;
  while (i < intervals.length && intervals[i][1] < s) out.push(intervals[i++]);
  while (i < intervals.length && intervals[i][0] <= e) { s = Math.min(s, intervals[i][0]); e = Math.max(e, intervals[i][1]); i++; }
  out.push([s, e]);
  while (i < intervals.length) out.push(intervals[i++]);
  return out;
}`,
  },

  // ---------------- Greedy ----------------
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    pattern: "greedy",
    requires: ARR,
    leetcode: lc(53, "maximum-subarray", "Maximum Subarray"),
    fn: "maxSubArray",
    params: ["nums"],
    statement: "Return the largest sum of any run of numbers next to each other in `nums` (at least one number). The classic answer is *Kadane's algorithm*.",
    examples: 2,
    cases: [c([[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6), c([[1]], 1), c([[5, 4, -1, 7, 8]], 23), c([[-3, -1, -2]], -1)],
    complexity: "O(n) time, O(1) space",
    ref: `function maxSubArray(nums) {
  let best = nums[0], cur = 0;
  for (const n of nums) { cur = Math.max(n, cur + n); best = Math.max(best, cur); }
  return best;
}`,
  },
  {
    id: "jump-game",
    title: "Jump Game",
    difficulty: "Medium",
    pattern: "greedy",
    requires: ARR,
    leetcode: lc(55, "jump-game", "Jump Game"),
    fn: "canJump",
    params: ["nums"],
    statement: "You start at the first position. `nums[i]` is the **longest** jump you can make from position `i`. Return `true` if you can reach the last position.",
    examples: 2,
    cases: [c([[2, 3, 1, 1, 4]], true), c([[3, 2, 1, 0, 4]], false), c([[0]], true), c([[2, 0, 0]], true), c([[1, 0, 1]], false)],
    complexity: "O(n) time, O(1) space",
    ref: `function canJump(nums) {
  let reach = 0;
  for (let i = 0; i < nums.length; i++) { if (i > reach) return false; reach = Math.max(reach, i + nums[i]); }
  return true;
}`,
  },
  // ---------------- More Hard problems ----------------
  {
    id: "longest-valid-parens",
    title: "Longest Valid Parentheses",
    difficulty: "Hard",
    pattern: "stack",
    requires: [...STR, "array"],
    leetcode: lc(32, "longest-valid-parentheses", "Longest Valid Parentheses"),
    fn: "longestValidParentheses",
    params: ["s"],
    statement:
      "`s` contains only `(` and `)`. Return the length of the longest piece of `s` (a run of neighbouring characters) whose brackets are correctly matched, like `\"(())\"` or `\"()()\"`.\n\nAim for O(n): one pass.",
    examples: 2,
    cases: [c(["(()"], 2), c([")()())"], 4), c([""], 0), c(["()(()"], 2), c(["()(())"], 6), c(["))(("], 0), c(["(()())(("], 6)],
    complexity: "O(n) time, O(n) space with a stack (or O(1) with two counting passes)",
    ref: `function longestValidParentheses(s) {
  const stack = [-1];
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") stack.push(i);
    else {
      stack.pop();
      if (!stack.length) stack.push(i);
      else best = Math.max(best, i - stack[stack.length - 1]);
    }
  }
  return best;
}`,
  },
  {
    id: "median-two-arrays",
    title: "Median of Two Sorted Arrays",
    difficulty: "Hard",
    pattern: "binary-search",
    requires: ARR,
    leetcode: lc(4, "median-of-two-sorted-arrays", "Median of Two Sorted Arrays"),
    fn: "findMedianSortedArrays",
    params: ["nums1", "nums2"],
    statement:
      "Both arrays are sorted. Return the **median** of all their numbers together: the middle number, or the average of the two middle numbers if the total count is even. At least one array is non-empty.\n\nMerging works in O(m + n). The real challenge: O(log(m + n)).",
    examples: 2,
    cases: [c([[1, 3], [2]], 2), c([[1, 2], [3, 4]], 2.5), c([[], [1]], 1), c([[0, 0], [0, 0]], 0), c([[2], []], 2), c([[1, 3, 8, 9, 15], [7, 11, 18, 19, 21, 25]], 11), c([[1, 2, 3, 4, 5], [6, 7, 8]], 4.5)],
    complexity: "O(log(min(m, n))) time with binary search on the smaller array, O(1) space",
    ref: `function findMedianSortedArrays(nums1, nums2) {
  if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);
  const m = nums1.length, n = nums2.length, half = Math.floor((m + n + 1) / 2);
  let lo = 0, hi = m;
  while (lo <= hi) {
    const i = Math.floor((lo + hi) / 2), j = half - i;
    const l1 = i > 0 ? nums1[i - 1] : -Infinity, r1 = i < m ? nums1[i] : Infinity;
    const l2 = j > 0 ? nums2[j - 1] : -Infinity, r2 = j < n ? nums2[j] : Infinity;
    if (l1 <= r2 && l2 <= r1) {
      const left = Math.max(l1, l2);
      return (m + n) % 2 ? left : (left + Math.min(r1, r2)) / 2;
    }
    if (l1 > r2) hi = i - 1;
    else lo = i + 1;
  }
}`,
  },
  {
    id: "merge-k-lists",
    title: "Merge k Sorted Lists",
    difficulty: "Hard",
    pattern: "linked-list",
    requires: REC,
    leetcode: lc(23, "merge-k-sorted-lists", "Merge k Sorted Lists"),
    fn: "mergeKLists",
    params: ["lists"],
    argShapes: ["lists"],
    returns: "list",
    statement:
      "`lists` is an array of linked lists, each sorted. Merge them all into one sorted list and return its first node.\n\nTests write each list as an array; your function gets an array of **first nodes** (or `null` for an empty list). Merging them one by one is slow when there are many lists. Can you do better?",
    examples: 2,
    cases: [c([[[1, 4, 5], [1, 3, 4], [2, 6]]], [1, 1, 2, 3, 4, 4, 5, 6]), c([[]], []), c([[[]]], []), c([[[5], [1], [3], [2], [4]]], [1, 2, 3, 4, 5]), c([[[], [-1, 0], []]], [-1, 0])],
    complexity: "O(N log k) time by merging pairs (or with a heap), N = total nodes, k = lists",
    ref: `function mergeKLists(lists) {
  const merge = (a, b) => {
    const dummy = { val: 0, next: null };
    let t = dummy;
    while (a && b) {
      if (a.val <= b.val) { t.next = a; a = a.next; } else { t.next = b; b = b.next; }
      t = t.next;
    }
    t.next = a || b;
    return dummy.next;
  };
  if (!lists.length) return null;
  while (lists.length > 1) {
    const next = [];
    for (let i = 0; i < lists.length; i += 2) next.push(i + 1 < lists.length ? merge(lists[i], lists[i + 1]) : lists[i]);
    lists = next;
  }
  return lists[0];
}`,
  },
  {
    id: "n-queens",
    title: "N-Queens (count)",
    difficulty: "Hard",
    pattern: "backtracking",
    requires: [...ARR, "recursion", "map-set"],
    leetcode: lc(52, "n-queens-ii", "N-Queens II"),
    fn: "totalNQueens",
    params: ["n"],
    statement:
      "In chess, a queen attacks every square in its row, its column and both diagonals. Return how many ways you can place `n` queens on an `n × n` board so that **no two attack each other**.\n\nFor `n = 4` there are 2 ways. Trying every arrangement is hopeless for `n = 9`: you must cut off bad choices early.",
    examples: 2,
    cases: [c([4], 2), c([1], 1), c([2], 0), c([3], 0), c([5], 10), c([6], 4), c([8], 92), c([9], 352)],
    complexity: "Roughly O(n!) time in the worst case, O(n) space",
    ref: `function totalNQueens(n) {
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  const place = (row) => {
    if (row === n) return 1;
    let count = 0;
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(row - c) || d2.has(row + c)) continue;
      cols.add(c); d1.add(row - c); d2.add(row + c);
      count += place(row + 1);
      cols.delete(c); d1.delete(row - c); d2.delete(row + c);
    }
    return count;
  };
  return place(0);
}`,
  },
  {
    id: "word-ladder",
    title: "Word Ladder",
    difficulty: "Hard",
    pattern: "graphs",
    requires: HASH,
    leetcode: lc(127, "word-ladder", "Word Ladder"),
    fn: "ladderLength",
    params: ["beginWord", "endWord", "wordList"],
    statement:
      "Turn `beginWord` into `endWord` by changing **one letter at a time**, and every word along the way (after the first) must be in `wordList`. Return the number of words in the **shortest** such chain, counting both ends, or `0` if it's impossible.\n\n`\"hit\" → \"hot\" → \"dot\" → \"dog\" → \"cog\"` has 5 words. Think of every word as a place on a map, and one-letter changes as roads.",
    examples: 2,
    cases: [
      c(["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]], 5),
      c(["hit", "cog", ["hot", "dot", "dog", "lot", "log"]], 0),
      c(["a", "c", ["a", "b", "c"]], 2),
      c(["hot", "dog", ["hot", "dog"]], 0),
      c(["red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]], 4),
    ],
    complexity: "O(N × L × 26) time with breadth-first search, N = words, L = word length",
    ref: `function ladderLength(beginWord, endWord, wordList) {
  const words = new Set(wordList);
  if (!words.has(endWord)) return 0;
  let level = [beginWord], steps = 1;
  const seen = new Set([beginWord]);
  while (level.length) {
    const next = [];
    for (const w of level) {
      if (w === endWord) return steps;
      for (let i = 0; i < w.length; i++) {
        for (let k = 97; k <= 122; k++) {
          const cand = w.slice(0, i) + String.fromCharCode(k) + w.slice(i + 1);
          if (words.has(cand) && !seen.has(cand)) { seen.add(cand); next.push(cand); }
        }
      }
    }
    level = next;
    steps++;
  }
  return 0;
}`,
  },
  // ---------------- Real-world code ----------------
  {
    id: "parse-query",
    title: "Parse a URL query string",
    difficulty: "Easy",
    pattern: "real-world",
    requires: [...STR, "object", "array"],
    fn: "parseQuery",
    params: ["query"],
    statement:
      "Web addresses carry data after a `?`, like `?page=2&sort=new`. Write `parseQuery(query)` that turns such a string into an object: `{ page: \"2\", sort: \"new\" }`.\n\n- The string may start with `?` (ignore it) or not.\n- Values stay **strings**.\n- A key with no `=` gets the value `\"\"`.\n- If a key appears twice, the **last** one wins.\n- An empty string gives `{}`.\n\nEvery web framework has a function like this inside.",
    examples: 2,
    cases: [
      c(["?page=2&sort=new"], { page: "2", sort: "new" }),
      c(["q=js&debug"], { q: "js", debug: "" }),
      c([""], {}),
      c(["?"], {}),
      c(["a=1&a=2"], { a: "2" }),
      c(["?name=ada&lang=en&x=y=z"], { name: "ada", lang: "en", x: "y=z" }),
    ],
    complexity: "O(n) time and space, n = length of the string",
    ref: `function parseQuery(query) {
  const result = {};
  const s = query.startsWith("?") ? query.slice(1) : query;
  if (!s) return result;
  for (const part of s.split("&")) {
    if (!part) continue;
    const i = part.indexOf("=");
    if (i === -1) result[part] = "";
    else result[part.slice(0, i)] = part.slice(i + 1);
  }
  return result;
}`,
  },
  {
    id: "group-by",
    title: "Group records by a field",
    difficulty: "Easy",
    pattern: "real-world",
    requires: [...HASH, "array-methods"],
    fn: "groupBy",
    params: ["items", "key"],
    statement:
      "You get a list of objects, like users from a database, and a field name. Return an object where each value of that field maps to the list of items that have it, **in their original order**.\n\n`groupBy([{n:\"a\",team:\"red\"},{n:\"b\",team:\"blue\"},{n:\"c\",team:\"red\"}], \"team\")` gives `{ red: [{n:\"a\",team:\"red\"},{n:\"c\",team:\"red\"}], blue: [{n:\"b\",team:\"blue\"}] }`.\n\nDashboards and reports do this all day.",
    examples: 1,
    cases: [
      c([[{ n: "a", team: "red" }, { n: "b", team: "blue" }, { n: "c", team: "red" }], "team"], { red: [{ n: "a", team: "red" }, { n: "c", team: "red" }], blue: [{ n: "b", team: "blue" }] }),
      c([[], "x"], {}),
      c([[{ id: 1, age: 30 }, { id: 2, age: 30 }], "age"], { 30: [{ id: 1, age: 30 }, { id: 2, age: 30 }] }),
    ],
    complexity: "O(n) time and space",
    ref: `function groupBy(items, key) {
  const groups = {};
  for (const item of items) {
    const k = item[key];
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}`,
  },
  {
    id: "flatten-object",
    title: "Flatten a nested object",
    difficulty: "Medium",
    pattern: "real-world",
    requires: REC,
    fn: "flatten",
    params: ["obj"],
    statement:
      "Settings files and databases often store nested objects as flat keys with dots. Write `flatten(obj)`:\n\n`flatten({ a: 1, b: { c: 2, d: { e: 3 } } })` gives `{ a: 1, \"b.c\": 2, \"b.d.e\": 3 }`.\n\n- Only plain objects are opened up. Arrays, strings, numbers, `null` and `true`/`false` are kept as values.\n- An empty nested object disappears (it has no keys to keep).",
    examples: 1,
    cases: [
      c([{ a: 1, b: { c: 2, d: { e: 3 } } }], { a: 1, "b.c": 2, "b.d.e": 3 }),
      c([{}], {}),
      c([{ x: null, y: [1, 2], z: { w: "hi" } }], { x: null, y: [1, 2], "z.w": "hi" }),
      c([{ a: { b: { c: { d: true } } } }], { "a.b.c.d": true }),
      c([{ a: {}, b: 0 }], { b: 0 }),
    ],
    complexity: "O(total number of keys) time and space",
    ref: `function flatten(obj, prefix = "", out = {}) {
  for (const key in obj) {
    const value = obj[key];
    const path = prefix ? prefix + "." + key : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}`,
  },
  {
    id: "deep-equal",
    title: "Deep equality",
    difficulty: "Medium",
    pattern: "real-world",
    requires: REC,
    fn: "deepEqual",
    params: ["a", "b"],
    statement:
      "`===` says two different objects are never equal, even with the same contents. Testing libraries (like the `assert.deepEqual` you met in the mocha lesson) need a smarter check. Write `deepEqual(a, b)`:\n\n- Primitives (numbers, strings, booleans, `null`) are equal if `===`.\n- Arrays are equal if they have the same length and every item is deep-equal, in order.\n- Plain objects are equal if they have the same set of keys and every value is deep-equal.\n- An array is never equal to a plain object.",
    examples: 2,
    cases: [
      c([{ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 3 }] }], true),
      c([{ a: 1 }, { a: 1, b: 2 }], false),
      c([[1, 2], [2, 1]], false),
      c([null, {}], false),
      c([[], {}], false),
      c([5, 5], true),
      c(["5", 5], false),
      c([{ x: { y: null } }, { x: { y: null } }], true),
      c([{ a: 1, b: 2 }, { b: 2, a: 1 }], true),
      c([{ a: 1 }, { b: 1 }], false),
    ],
    complexity: "O(total size of both values) time, O(depth) space",
    ref: `function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
  }
  return true;
}`,
  },
  {
    id: "rate-limiter",
    title: "Rate limiter",
    difficulty: "Medium",
    pattern: "real-world",
    requires: [...HASH, "array-methods"],
    fn: "rateLimit",
    params: ["requests", "limit", "windowSize"],
    statement:
      "APIs protect themselves by refusing users who send too many requests. You get a list of requests `[userId, time]` sorted by time (seconds). A request is **allowed** if that user had fewer than `limit` *allowed* requests in the last `windowSize` seconds, that is, with time `> time - windowSize`. Return an array of `true`/`false`, one per request.\n\nThis is a classic system-design interview question at companies like Stripe and Cloudflare.",
    examples: 1,
    cases: [
      c([[["a", 1], ["a", 2], ["a", 3], ["b", 3], ["a", 11]], 2, 10], [true, true, false, true, true]),
      c([[], 1, 5], []),
      c([[["u", 0], ["u", 5], ["u", 5], ["u", 10]], 1, 5], [true, true, false, true]),
      c([[["x", 1], ["x", 1], ["x", 1]], 3, 1], [true, true, true]),
    ],
    complexity: "O(n) amortised time with a queue per user, O(n) space",
    ref: `function rateLimit(requests, limit, windowSize) {
  const recent = new Map();
  return requests.map(([user, time]) => {
    const q = recent.get(user) || [];
    while (q.length && q[0] <= time - windowSize) q.shift();
    recent.set(user, q);
    if (q.length >= limit) return false;
    q.push(time);
    return true;
  });
}`,
  },
  // ---------------- Design & build ----------------
  {
    id: "min-stack",
    title: "Min Stack",
    difficulty: "Medium",
    pattern: "design",
    requires: CLS,
    leetcode: lc(155, "min-stack", "Min Stack"),
    fn: "MinStack",
    params: [],
    methods: [
      { name: "push", params: ["val"] },
      { name: "pop", params: [] },
      { name: "top", params: [] },
      { name: "getMin", params: [] },
    ],
    statement:
      "Build a class `MinStack`: a stack that can also tell you its smallest value **instantly**.\n\n- `push(val)` puts a value on top.\n- `pop()` removes the top value (returns nothing).\n- `top()` returns the top value.\n- `getMin()` returns the smallest value in the stack.\n\nEvery method must be O(1): no looping over the stack.\n\nTests call your methods in order, like `[\"push\",\"push\",\"getMin\"]` with arguments `[[3],[1],[]]`, and compare what each call returns (`null` when it returns nothing).",
    examples: 1,
    cases: [
      c([[], ["push", "push", "push", "getMin", "pop", "top", "getMin"], [[-2], [0], [-3], [], [], [], []]], [null, null, null, -3, null, 0, -2]),
      c([[], ["push", "getMin", "push", "getMin", "push", "getMin", "pop", "getMin"], [[5], [], [5], [], [7], [], [], []]], [null, 5, null, 5, null, 5, null, 5]),
      c([[], ["push", "push", "pop", "pop", "push", "getMin", "top"], [[1], [2], [], [], [9], [], []]], [null, null, null, null, null, 9, 9]),
    ],
    complexity: "O(1) time per method, O(n) space",
    ref: `class MinStack {
  constructor() { this.items = []; this.mins = []; }
  push(val) { this.items.push(val); this.mins.push(this.mins.length ? Math.min(val, this.mins[this.mins.length - 1]) : val); }
  pop() { this.items.pop(); this.mins.pop(); }
  top() { return this.items[this.items.length - 1]; }
  getMin() { return this.mins[this.mins.length - 1]; }
}`,
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Medium",
    pattern: "design",
    requires: CLS,
    leetcode: lc(146, "lru-cache", "LRU Cache"),
    fn: "LRUCache",
    params: ["capacity"],
    methods: [
      { name: "get", params: ["key"] },
      { name: "put", params: ["key", "value"] },
    ],
    statement:
      "Browsers, databases and CDNs keep a **cache**: a small store of recent results. When it's full, they throw out the **least recently used** item. Build `LRUCache`:\n\n- `new LRUCache(capacity)` holds at most `capacity` items.\n- `get(key)` returns the value, or `-1` if missing. Reading a key makes it the most recently used.\n- `put(key, value)` adds or updates a key (that also makes it most recently used). If that makes the cache too big, remove the least recently used key.\n\nBoth methods must be O(1) on average.\n\nThis is one of the most asked interview questions at big tech.",
    examples: 1,
    cases: [
      c([[2], ["put", "put", "get", "put", "get", "put", "get", "get", "get"], [[1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]], [null, null, 1, null, -1, null, -1, 3, 4]),
      c([[2], ["put", "put", "put", "get", "get"], [[1, 1], [1, 10], [2, 2], [1], [2]]], [null, null, null, 10, 2]),
      c([[1], ["get", "put", "get", "put", "get", "get"], [[7], [7, 70], [7], [8, 80], [7], [8]]], [-1, null, 70, null, -1, 80]),
    ],
    complexity: "O(1) time per method, O(capacity) space",
    ref: `class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) return -1;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  put(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value);
  }
}`,
  },
  {
    id: "trie",
    title: "Trie (autocomplete)",
    difficulty: "Medium",
    pattern: "design",
    requires: CLS,
    leetcode: lc(208, "implement-trie-prefix-tree", "Implement Trie (Prefix Tree)"),
    fn: "Trie",
    params: [],
    methods: [
      { name: "insert", params: ["word"] },
      { name: "search", params: ["word"] },
      { name: "startsWith", params: ["prefix"] },
    ],
    statement:
      "Search boxes suggest words as you type. Under the hood is often a **trie**: a tree where each step down is one letter. Build `Trie`:\n\n- `insert(word)` stores a word.\n- `search(word)` returns `true` if that exact word was inserted.\n- `startsWith(prefix)` returns `true` if any inserted word starts with `prefix`.\n\nEach method should take time proportional to the length of the word, not the number of words stored.",
    examples: 1,
    cases: [
      c([[], ["insert", "search", "search", "startsWith", "insert", "search"], [["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]]], [null, true, false, true, null, true]),
      c([[], ["search", "startsWith", "insert", "startsWith", "search"], [["a"], [""], ["a"], ["a"], ["ab"]]], [false, true, null, true, false]),
      c([[], ["insert", "insert", "search", "startsWith", "startsWith"], [["car"], ["cart"], ["ca"], ["cart"], ["carts"]]], [null, null, false, true, false]),
    ],
    complexity: "O(length of the word) per method, O(total letters) space",
    ref: `class Trie {
  constructor() { this.root = {}; }
  insert(word) {
    let node = this.root;
    for (const ch of word) node = node[ch] || (node[ch] = {});
    node.end = true;
  }
  walk(s) {
    let node = this.root;
    for (const ch of s) { if (!node[ch]) return null; node = node[ch]; }
    return node;
  }
  search(word) { const n = this.walk(word); return !!(n && n.end); }
  startsWith(prefix) { return this.walk(prefix) !== null; }
}`,
  },
  {
    id: "bank",
    title: "Simple bank system",
    difficulty: "Medium",
    pattern: "design",
    requires: CLS,
    leetcode: lc(2043, "simple-bank-system", "Simple Bank System"),
    fn: "Bank",
    params: ["balances"],
    methods: [
      { name: "deposit", params: ["account", "money"] },
      { name: "withdraw", params: ["account", "money"] },
      { name: "transfer", params: ["from", "to", "money"] },
    ],
    statement:
      "Build the core of a banking app. `new Bank(balances)` gets the starting balances: account **1** has `balances[0]`, account **2** has `balances[1]`, and so on.\n\nEach method returns `true` if it worked, `false` if not (and then changes **nothing**):\n\n- `deposit(account, money)`: fails if the account doesn't exist.\n- `withdraw(account, money)`: fails if the account doesn't exist or has less than `money`.\n- `transfer(from, to, money)`: fails if either account doesn't exist or `from` has less than `money`.\n\nReal money code is all about refusing bad operations without breaking anything.",
    examples: 1,
    cases: [
      c([[[10, 100, 20, 50, 30]], ["withdraw", "transfer", "deposit", "transfer", "withdraw"], [[3, 10], [5, 1, 20], [5, 20], [3, 4, 15], [10, 50]]], [true, true, true, false, false]),
      c([[[10]], ["deposit", "withdraw", "withdraw", "transfer"], [[1, 5], [1, 15], [1, 1], [1, 1, 0]]], [true, true, false, true]),
      c([[[5]], ["transfer", "deposit", "withdraw"], [[0, 1, 1], [2, 1], [2, 1]]], [false, false, false]),
    ],
    complexity: "O(1) time per method, O(number of accounts) space",
    ref: `class Bank {
  constructor(balances) { this.b = [...balances]; }
  ok(a) { return a >= 1 && a <= this.b.length; }
  deposit(a, m) { if (!this.ok(a)) return false; this.b[a - 1] += m; return true; }
  withdraw(a, m) { if (!this.ok(a) || this.b[a - 1] < m) return false; this.b[a - 1] -= m; return true; }
  transfer(f, t, m) { if (!this.ok(t) || !this.withdraw(f, m)) return false; this.b[t - 1] += m; return true; }
}`,
  },
];

export function problemById(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

// ---------------- Test harness (runs in the browser sandbox and in Node) ----------------

/** Helper code the tests use: building linked lists / trees from arrays, comparing answers. */
const HELPERS = `
function __list(a){let h=null;for(let i=a.length-1;i>=0;i--)h={val:a[i],next:h};return h}
function __unlist(h){const o=[];let n=0;while(h&&n++<100000){o.push(h.val);h=h.next}return o}
function __tree(a){if(!a.length||a[0]===null)return null;const root={val:a[0],left:null,right:null};const q=[root];let i=1;while(q.length&&i<a.length){const n=q.shift();if(i<a.length&&a[i]!==null){n.left={val:a[i],left:null,right:null};q.push(n.left)}i++;if(i<a.length&&a[i]!==null){n.right={val:a[i],left:null,right:null};q.push(n.right)}i++}return root}
function __untree(r){const o=[];const q=[r];while(q.length){const n=q.shift();if(n){o.push(n.val);q.push(n.left,n.right)}else o.push(null)}while(o.length&&o[o.length-1]===null)o.pop();return o}
function __in(v,s){v=JSON.parse(JSON.stringify(v));return s==="lists"?v.map(__list):s==="list"?__list(v):s==="tree"?__tree(v):v}
function __out(v,s){return s==="list"?__unlist(v):s==="tree"?__untree(v):v}
function __key(v){return JSON.stringify(v)}
function __norm(v,m){if(!Array.isArray(v))return v;if(m==="unordered")return [...v].sort((a,b)=>__key(a)<__key(b)?-1:1);if(m==="unorderedDeep")return v.map(x=>Array.isArray(x)?[...x].sort((a,b)=>__key(a)<__key(b)?-1:1):x).sort((a,b)=>__key(a)<__key(b)?-1:1);return v}
function __eq(a,b){return __key(a)===__key(b)}
function __fail(m){const e=new Error(m);e.name="AssertionError";throw e}
function __show(v){const s=JSON.stringify(v);return s===undefined?String(v):s.length>300?s.slice(0,300)+"…":s}
`;

/**
 * Test code for a problem, in the mocha style the sandbox runs. `which` = "examples" runs only
 * the visible examples; "all" runs every case. Failures report input, expected and actual.
 */
export function buildTests(p: Problem, which: "examples" | "all"): string {
  const cases = which === "examples" ? p.cases.slice(0, p.examples) : p.cases;
  const spec = { fn: p.fn, design: !!p.methods, compare: p.compare ?? "exact", argShapes: p.argShapes ?? [], returns: p.returns ?? "value", examples: p.examples, cases };
  return `${HELPERS}
(function(){
const __P = ${JSON.stringify(spec)};
const __fn = typeof ${p.fn} === "function" ? ${p.fn} : null;
describe("${p.id}", function(){
  __P.cases.forEach(function(c, i){
    it((i < __P.examples ? "Example " : "Hidden test ") + (i + 1), function(){
      if (!__fn) __fail("I can't find a ${p.methods ? "class" : "function"} named ${p.fn}. Keep that exact name.");
      let got, input;
      if (__P.design) {
        const ctor = c.args[0], ops = c.args[1], argLists = c.args[2];
        input = "new " + __P.fn + "(" + ctor.map(__show).join(", ") + ")" + ops.map(function(op, k){ return ", " + op + "(" + argLists[k].map(__show).join(", ") + ")"; }).join("");
        const obj = new __fn(...JSON.parse(JSON.stringify(ctor)));
        got = ops.map(function(op, k){
          if (typeof obj[op] !== "function") __fail("Your class has no method named " + op + ".");
          const r = obj[op].apply(obj, JSON.parse(JSON.stringify(argLists[k])));
          return r === undefined ? null : r;
        });
      } else {
        input = c.args.map(__show).join(", ");
        const args = c.args.map(function(a, k){ return __in(a, __P.argShapes[k]); });
        got = __out(__fn.apply(null, args), __P.returns);
      }
      if (!__eq(__norm(got, __P.compare), __norm(c.out, __P.compare)))
        __fail((__P.design ? "Calls: " : "Input: ") + input + "\\nExpected: " + __show(c.out) + "\\nYour output: " + __show(got));
    });
  });
});
})();`;
}

/** The code the learner starts with. */
export function starterCode(p: Problem): string {
  const shapes = p.argShapes ?? [];
  const notes: string[] = [];
  if (shapes.includes("list") || shapes.includes("lists") || p.returns === "list") notes.push("// A list node looks like: { val: 1, next: { val: 2, next: null } }");
  if (shapes.includes("tree") || p.returns === "tree") notes.push("// A tree node looks like: { val: 1, left: node or null, right: node or null }");
  if (p.methods) {
    const methods = p.methods.map((m) => `\n  ${m.name}(${m.params.join(", ")}) {\n  }\n`).join("");
    return `class ${p.fn} {\n  constructor(${p.params.join(", ")}) {\n    // Your code here\n  }\n${methods}}\n`;
  }
  return `${notes.join("\n")}${notes.length ? "\n" : ""}function ${p.fn}(${p.params.join(", ")}) {\n  // Your code here\n}\n`;
}
