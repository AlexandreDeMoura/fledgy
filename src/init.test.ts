import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { commitAll, git, hostRepo } from "./testing/host-repo.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

// A host as Auxilia is: the package installed in `web/`, the git root above it.
function host(files: Record<string, string> = {}): string {
  const root = hostRepo({ "web/node_modules/fledgy/package.json": "{}", ...files });
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

// Runs the built binary from `web/`, where `npx` finds it.
function init(root: string) {
  return spawnSync("node", [cli, "init", "--shared"], { cwd: path.join(root, "web"), encoding: "utf8" });
}

// A stand-in for the published package, which a private install puts in
// `.fledgy/`: a folder npm installs from without the network.
const fakePackage = hostRepo({
  "package.json": JSON.stringify({ name: "fledgy", version: "0.0.0-test", bin: { fledgy: "cli.js" } }),
  "cli.js": "#!/usr/bin/env node\n",
});

// Runs the built binary as a Builder runs `npx fledgy`, from wherever in the
// repo, with no terminal to ask in.
function fledgy(root: string, ...args: string[]) {
  return spawnSync("node", [cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, FLEDGY_PACKAGE: fakePackage } });
}

// What `git status` shows, untracked files one by one.
const gitSees = (root: string) => git(root, "status", "--porcelain", "--untracked-files=all");

const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), "utf8");
const settings = (root: string) => JSON.parse(read(root, ".claude/settings.json"));

const stopHook = {
  hooks: [{ type: "command", command: '"$(git rev-parse --show-toplevel)/web/node_modules/.bin/fledgy" stop-hook' }],
};

test("init on a repo with no .claude/ installs the skills, the Stop hook and the CLAUDE.md line at the git root", () => {
  const root = host();

  const run = init(root);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(read(root, ".claude/skills/maintain-knowledge-base/SKILL.md")).toMatch(/^---\nname: maintain-knowledge-base\n/);
  expect(read(root, ".claude/skills/write-a-flow/SKILL.md")).toMatch(/^---\nname: write-a-flow\n/);
  expect(read(root, ".claude/skills/map-the-app/SKILL.md")).toMatch(/^---\nname: map-the-app\n/);
  expect(settings(root)).toEqual({ hooks: { Stop: [stopHook] } });
  expect(read(root, "CLAUDE.md")).toContain("run `npx fledgy check` in `web/`");
  expect(run.stdout).toBe(
    "Fledgy is installed for this repo's team: commit what it added.\n" +
      "  .claude/skills/  .claude/settings.json  CLAUDE.md\n\n" +
      "Next: open Claude Code at the repo root and type /map-the-app\n" +
      "Then: npx fledgy view in web/, to read what it writes.   Guide: https://github.com/AlexandreDeMoura/fledgy/tree/main/docs\n",
  );
});

test("init keeps the settings, hooks and CLAUDE.md the host already has", () => {
  const formatter = { matcher: "Edit", hooks: [{ type: "command", command: "npm run format" }] };
  const notify = { hooks: [{ type: "command", command: "say done" }] };
  const root = host({
    ".claude/settings.json": JSON.stringify({
      permissions: { allow: ["Bash(npm test)"] },
      hooks: { PostToolUse: [formatter], Stop: [notify] },
    }),
    ".claude/skills/deploy/SKILL.md": "---\nname: deploy\n---\n",
    "CLAUDE.md": "# Auxilia\n\nUse pnpm.\n",
  });

  const run = init(root);

  expect(run.status).toBe(0);
  expect(settings(root)).toEqual({
    permissions: { allow: ["Bash(npm test)"] },
    hooks: { PostToolUse: [formatter], Stop: [notify, stopHook] },
  });
  expect(read(root, ".claude/skills/deploy/SKILL.md")).toBe("---\nname: deploy\n---\n");
  expect(read(root, "CLAUDE.md")).toMatch(/^# Auxilia\n\nUse pnpm\.\n\n`knowledge-base\/` describes/);
});

test("init run again after an upgrade refreshes its copies and adds nothing twice", () => {
  const root = host({ "CLAUDE.md": "# Auxilia\n" });
  init(root);
  const skill = path.join(root, ".claude/skills/maintain-knowledge-base");
  fs.writeFileSync(path.join(skill, "SKILL.md"), "an older version of the skill");
  fs.writeFileSync(path.join(skill, "DROPPED.md"), "a file the new version no longer has");
  const claudeMd = read(root, "CLAUDE.md");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), claudeMd.replace("npx fledgy check", "npx fledgy old-check"));

  const run = init(root);

  expect(run.status).toBe(0);
  expect(read(root, ".claude/skills/maintain-knowledge-base/SKILL.md")).toMatch(/^---\nname: maintain-knowledge-base\n/);
  expect(fs.existsSync(path.join(skill, "DROPPED.md"))).toBe(false);
  expect(settings(root)).toEqual({ hooks: { Stop: [stopHook] } });
  expect(read(root, "CLAUDE.md")).toBe(claudeMd);
});

test("init with the package installed at the git root points the hook and the instruction there", () => {
  const root = hostRepo({ "node_modules/fledgy/package.json": "{}" });
  spawnSync("git", ["init", "--quiet"], { cwd: root });

  const run = spawnSync("node", [cli, "init", "--shared"], { cwd: root, encoding: "utf8" });

  expect(run.status).toBe(0);
  expect(settings(root).hooks.Stop[0].hooks[0].command).toBe(
    '"$(git rev-parse --show-toplevel)/node_modules/.bin/fledgy" stop-hook',
  );
  expect(read(root, "CLAUDE.md")).toContain("run `npx fledgy check` at the repo root");
});

test("init refuses, and writes nothing, where the package is not installed", () => {
  const root = hostRepo({ "web/package.json": "{}" });
  spawnSync("git", ["init", "--quiet"], { cwd: root });

  const run = init(root);

  expect(run.status).toBe(1);
  expect(run.stderr).toContain("fledgy is not installed here");
  expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
});

test("init leaves a settings file it cannot read as it was", () => {
  const root = host({ ".claude/settings.json": "{ not json" });

  const run = init(root);

  expect(run.status).toBe(1);
  expect(run.stderr).toContain(".claude/settings.json");
  expect(read(root, ".claude/settings.json")).toBe("{ not json");
  expect(fs.existsSync(path.join(root, ".claude/skills"))).toBe(false);
});

test("init copies every file of the map-the-app skill that its SKILL.md points at", () => {
  const root = host();

  init(root);

  const skill = ".claude/skills/map-the-app";
  const pointedAt = [...read(root, `${skill}/SKILL.md`).matchAll(/`([a-z-]+\.md)`/g)].map(([, file]) => file!);
  expect(pointedAt.length).toBeGreaterThan(0);
  for (const file of pointedAt) expect(fs.existsSync(path.join(root, skill, file)), file).toBe(true);
});

test("init installs Fledgy for the Builder only: the library in .fledgy/, the skills, a local hook and CLAUDE.local.md, none of it seen by git", () => {
  const root = hostRepo({ "README.md": "# Auxilia\n" });
  commitAll(root, "the app");

  const run = fledgy(root, "init");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(
    /^Fledgy is installed for you only: git sees none of what it added\.\n  \.fledgy\/  \.claude\/skills\/  \.claude\/settings\.local\.json  CLAUDE\.local\.md\n/,
  );
  expect(run.stdout).toMatch(
    /\n\nNext: open Claude Code here and type \/map-the-app\nThen: git fledgy view, to read what it writes\. {3}Guide: https:\/\/github\.com\/AlexandreDeMoura\/fledgy\/tree\/main\/docs\n$/,
  );
  expect(fs.existsSync(path.join(root, ".fledgy/node_modules/.bin/fledgy"))).toBe(true);
  expect(read(root, ".claude/skills/map-the-app/SKILL.md")).toMatch(/^---\nname: map-the-app\n/);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({
    hooks: { Stop: [{ hooks: [{ type: "command", command: '"$(git rev-parse --show-toplevel)/.fledgy/node_modules/.bin/fledgy" stop-hook' }] }] },
  });
  expect(read(root, "CLAUDE.local.md")).toContain("then run `git fledgy check` and fix what it reports");
  expect(read(root, "CLAUDE.local.md")).toContain("never commit them");
  expect(fs.existsSync(path.join(root, ".claude/settings.json"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(false);
  fs.mkdirSync(path.join(root, "knowledge-base"));
  fs.writeFileSync(path.join(root, "knowledge-base/areas.yaml"), "chat:\n  name: Chat\n");
  expect(gitSees(root)).toBe("");
});

test("init run again keeps what the Builder had, refreshes its own copies and adds nothing twice", () => {
  const root = hostRepo({ "README.md": "# Auxilia\n" });
  commitAll(root, "the app");
  fs.writeFileSync(path.join(root, ".git/info/exclude"), "# my own\n*.log\n");
  fs.mkdirSync(path.join(root, ".claude"));
  fs.writeFileSync(path.join(root, ".claude/settings.local.json"), JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }));
  fs.writeFileSync(path.join(root, "CLAUDE.local.md"), "Answer in French.\n");
  fledgy(root, "init");
  const once = { exclude: read(root, ".git/info/exclude"), settings: read(root, ".claude/settings.local.json"), claude: read(root, "CLAUDE.local.md") };
  fs.writeFileSync(path.join(root, ".claude/skills/write-a-flow/SKILL.md"), "an older version of the skill");

  const run = fledgy(root, "init");

  expect(run.status).toBe(0);
  expect(read(root, ".claude/skills/write-a-flow/SKILL.md")).toMatch(/^---\nname: write-a-flow\n/);
  expect(read(root, ".git/info/exclude")).toBe(once.exclude);
  expect(once.exclude).toMatch(/^# my own\n\*\.log\n# fledgy: .*\n\/\.fledgy\/\n/);
  expect(once.exclude).toContain("\n/knowledge-base/\n");
  expect(read(root, ".claude/settings.local.json")).toBe(once.settings);
  expect(JSON.parse(once.settings).permissions).toEqual({ allow: ["Bash(ls)"] });
  expect(read(root, "CLAUDE.local.md")).toBe(once.claude);
  expect(once.claude).toMatch(/^Answer in French\.\n\n`knowledge-base\/` describes/);
});

test("init refuses, and writes nothing, when the repo commits a path a private install would replace", () => {
  const root = hostRepo({ ".claude/skills/map-the-app/SKILL.md": "the team's own skill\n" });
  commitAll(root, "the app");

  const run = fledgy(root, "init");

  expect(run.status).toBe(1);
  expect(run.stderr).toContain(".claude/skills/map-the-app/SKILL.md is committed in this repo");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.local.md"))).toBe(false);
  expect(gitSees(root)).toBe("");
});

test("init does nothing in a repo whose team already has Fledgy", () => {
  const root = host();
  init(root);
  commitAll(root, "the team installs Fledgy");

  const run = fledgy(root, "init");

  expect(run.status).toBe(0);
  expect(run.stdout).toBe("Fledgy is already installed for this repo's team. Nothing to do.\n");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.local.md"))).toBe(false);
});

test("init writes nothing when npm cannot install the library", () => {
  const root = hostRepo({ "README.md": "# Auxilia\n" });
  commitAll(root, "the app");

  const run = spawnSync("node", [cli, "init"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FLEDGY_PACKAGE: path.join(root, "no-such-package") },
  });

  expect(run.status).toBe(1);
  expect(run.stderr).toContain("npm could not install");
  expect(gitSees(root)).toBe("");
});

test("init --shared replaces a private install, and stops hiding the knowledge base so it can be committed", () => {
  const root = host({ "web/package.json": "{}" });
  commitAll(root, "the app");
  fledgy(root, "init");
  const settingsLocal = JSON.parse(read(root, ".claude/settings.local.json"));
  fs.writeFileSync(path.join(root, ".claude/settings.local.json"), JSON.stringify({ ...settingsLocal, permissions: { allow: ["Bash(ls)"] } }));
  fs.mkdirSync(path.join(root, "knowledge-base"));
  fs.writeFileSync(path.join(root, "knowledge-base/areas.yaml"), "chat:\n  name: Chat\n");

  const run = init(root);

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/^Fledgy is installed for this repo's team: commit what it added\.\n/);
  expect(run.stdout).toContain("knowledge-base/ is no longer hidden from git");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, "CLAUDE.local.md"))).toBe(false);
  expect(JSON.parse(read(root, ".claude/settings.local.json"))).toEqual({ permissions: { allow: ["Bash(ls)"] } });
  expect(settings(root)).toEqual({ hooks: { Stop: [stopHook] } });
  // Claude Code may add the local settings to the Builder's global git ignore.
  const seen = gitSees(root).split("\n").filter((line) => !line.endsWith(".claude/settings.local.json"));
  expect(seen.sort()).toEqual([
    "?? .claude/settings.json",
    "?? .claude/skills/maintain-knowledge-base/SKILL.md",
    "?? .claude/skills/map-the-app/SKILL.md",
    "?? .claude/skills/map-the-app/area.md",
    "?? .claude/skills/map-the-app/end.md",
    "?? .claude/skills/map-the-app/inventory.md",
    "?? .claude/skills/write-a-flow/SKILL.md",
    "?? CLAUDE.md",
    "?? knowledge-base/areas.yaml",
  ]);
});

test("uninstall removes a private install and keeps the knowledge base, still hidden from git", () => {
  const root = hostRepo({ ".claude/skills/deploy/SKILL.md": "---\nname: deploy\n---\n" });
  commitAll(root, "the app");
  fs.writeFileSync(path.join(root, "CLAUDE.local.md"), "Answer in French.\n");
  fledgy(root, "init");
  fs.mkdirSync(path.join(root, "knowledge-base"));
  fs.writeFileSync(path.join(root, "knowledge-base/areas.yaml"), "chat:\n  name: Chat\n");

  const run = fledgy(root, "uninstall");

  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/^Fledgy is removed\.\n/);
  expect(run.stdout).toContain("knowledge-base/ is kept, still hidden from git");
  expect(fs.existsSync(path.join(root, ".fledgy"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/skills/map-the-app"))).toBe(false);
  expect(fs.existsSync(path.join(root, ".claude/settings.local.json"))).toBe(false);
  expect(read(root, "CLAUDE.local.md")).toBe("Answer in French.\n");
  expect(read(root, "knowledge-base/areas.yaml")).toBe("chat:\n  name: Chat\n");
  expect(gitSees(root)).toBe("");
  expect(read(root, ".git/info/exclude")).not.toContain(".fledgy");
});

test("uninstall removes a shared install and keeps the knowledge base", () => {
  const root = host({ "CLAUDE.md": "# Auxilia\n", "knowledge-base/areas.yaml": "chat:\n  name: Chat\n" });
  init(root);
  commitAll(root, "the team installs Fledgy");

  const run = fledgy(path.join(root, "web"), "uninstall");

  expect(run.status).toBe(0);
  expect(run.stdout).toContain("npm uninstall fledgy");
  expect(read(root, "CLAUDE.md")).toBe("# Auxilia\n");
  expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  expect(read(root, "knowledge-base/areas.yaml")).toBe("chat:\n  name: Chat\n");
  expect(gitSees(root).split("\n").map((line) => line.trim()).sort()).toEqual([
    "D .claude/settings.json",
    "D .claude/skills/maintain-knowledge-base/SKILL.md",
    "D .claude/skills/map-the-app/SKILL.md",
    "D .claude/skills/map-the-app/area.md",
    "D .claude/skills/map-the-app/end.md",
    "D .claude/skills/map-the-app/inventory.md",
    "D .claude/skills/write-a-flow/SKILL.md",
    "M CLAUDE.md",
  ]);
});
