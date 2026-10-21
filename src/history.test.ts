import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { stopHook } from "./stop-hook.js";
import { commitAll, git, hostRepo, knowledgeBase } from "./testing/host-repo.js";

let home: string;
beforeEach(() => {
  home = hostRepo({ ".gitconfig": "" });
  vi.stubEnv("HOME", home);
  vi.stubEnv("GIT_CONFIG_GLOBAL", path.join(home, ".gitconfig"));
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});
afterEach(() => vi.unstubAllEnvs());

function bytes(dir: string): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter(file => fs.lstatSync(path.join(dir, file)).isFile())
    .map(file => [file, fs.readFileSync(path.join(dir, file)).toString("base64")]));
}

test.each(["Private", "Shared"])("the Stop hook saves a Knowledge base version in a %s install without touching the app's git", async install => {
  const root = hostRepo({ "code.ts": "export function run() {}\n" });
  const first = commitAll(root, "app");
  if (install === "Private") fs.appendFileSync(path.join(root, ".git/info/exclude"), "\nknowledge-base/\n");
  for (const [file, content] of Object.entries(knowledgeBase("code.ts#run", "backend"))) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  if (install === "Shared") commitAll(root, "map");
  const before = bytes(path.join(root, ".git"));
  const status = git(root, "--no-optional-locks", "status", "--porcelain");
  expect(await stopHook(root, false)).toBeUndefined();
  const store = path.join(home, ".fledgy", first, "history.git");
  expect(fs.existsSync(store)).toBe(true);
  expect(git(root, `--git-dir=${store}`, "show", "--format=", "--all", "--", "knowledge-base/parts/tool-approval.yaml")).toContain("code.ts#run");
  expect(bytes(path.join(root, ".git"))).toEqual(before);
  expect(git(root, "--no-optional-locks", "status", "--porcelain")).toBe(status);
  const versions = () => git(root, `--git-dir=${store}`, "rev-list", "--all", "--count");
  expect(versions()).toBe("1");
  await stopHook(root, false);
  expect(versions()).toBe("1");
  commitAll(root, "new HEAD");
  await stopHook(root, false);
  expect(versions()).toBe("2");
  fs.appendFileSync(path.join(root, "knowledge-base/parts/tool-approval.yaml"), "\n");
  await stopHook(root, false);
  expect(versions()).toBe("3");
});

test("linked worktrees save to separate refs in one History store", async () => {
  const root = hostRepo({ ...knowledgeBase("code.ts#run", "backend"), "code.ts": "export function run() {}\n" });
  const first = commitAll(root, "app");
  const other = path.join(hostRepo({}), "feature");
  git(root, "worktree", "add", "--quiet", "-b", "feature", other);
  await Promise.all([stopHook(root, false), stopHook(other, false)]);
  const store = path.join(home, ".fledgy", first, "history.git");
  expect(git(root, `--git-dir=${store}`, "for-each-ref", "--format=%(refname)").split("\n")).toHaveLength(2);
});

test("a failing store leaves the Stop hook answer unchanged, and failing checks still save versions", async () => {
  const root = hostRepo({ ...knowledgeBase("code.ts#missing", "backend"), "code.ts": "export function run() {}\n" });
  const first = commitAll(root, "app");
  const expected = await stopHook(root, false, home);
  expect(expected).toMatchObject({ decision: "block" });
  expect(fs.existsSync(path.join(home, ".fledgy", first, "history.git"))).toBe(true);
  const blocked = path.join(home, "not-a-directory");
  fs.writeFileSync(blocked, "blocked");
  expect(await stopHook(root, false, blocked)).toEqual(expected);
});

test("uninstall and switching to Shared keep the History store", async () => {
  const { initShared, uninstall } = await import("./init.js");
  const root = hostRepo({ ...knowledgeBase("code.ts#run", "backend"), "code.ts": "export function run() {}\n", "node_modules/fledgy/package.json": "{}" });
  const first = commitAll(root, "app");
  await stopHook(root, false, home);
  const store = path.join(home, ".fledgy", first, "history.git");
  const before = bytes(store);
  initShared(root, root);
  expect(bytes(store)).toEqual(before);
  uninstall(root, root);
  expect(bytes(store)).toEqual(before);
});

test("removing the whole Knowledge base saves an empty version without changing the hook answer", async () => {
  const root = hostRepo({ ...knowledgeBase("code.ts#run", "backend"), "code.ts": "export function run() {}\n" });
  const first = commitAll(root, "app");
  await stopHook(root, false, home);
  fs.rmSync(path.join(root, "knowledge-base"), { recursive: true });
  expect(await stopHook(root, false, home)).toBeUndefined();
  const store = path.join(home, ".fledgy", first, "history.git");
  expect(git(root, `--git-dir=${store}`, "rev-list", "--all", "--count")).toBe("2");
  const latest = git(root, `--git-dir=${store}`, "for-each-ref", "--format=%(objectname)");
  expect(git(root, `--git-dir=${store}`, "ls-tree", "-r", latest)).toBe("");
});
