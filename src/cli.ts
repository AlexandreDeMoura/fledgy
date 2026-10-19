#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { parseArgs } from "node:util";
import { runDeterministicCheck } from "./deterministic-check.js";
import { offerToMap } from "./first-run.js";
import { initPrivate, initShared, uninstall } from "./init.js";
import { qaResultsFile } from "./qa-results.js";
import { problemLines, stopHook } from "./stop-hook.js";
import { startView } from "./view.js";

// The knowledge base sits at the root of the git repo, wherever in it the
// command is run from.
function repoRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

async function check(): Promise<number> {
  const problems = await runDeterministicCheck(repoRoot());
  if (problems.length === 0) {
    console.log("Knowledge base check passed.");
    return 0;
  }
  console.log(`Knowledge base check failed: ${problems.length === 1 ? "1 problem" : `${problems.length} problems`}.\n`);
  console.log(problemLines(problems));
  return 1;
}

// Keeps serving until the process is stopped.
async function view(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: { port: { type: "string", default: "4173" } } });
  const { url } = await startView(repoRoot(), { port: Number(values.port) });
  console.log(`Knowledge base web view: ${url}`);
}

// What a private install puts in `.fledgy/`: this very version from npm,
// unless `FLEDGY_PACKAGE` names another source, such as a tarball tried
// before it is published.
function packageSpec(): string {
  const { version } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  return process.env.FLEDGY_PACKAGE || `fledgy@${version}`;
}

// Asks in the terminal, when init has one on both sides.
async function ask(question: string): Promise<string> {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(question);
  } catch {
    return "n";
  } finally {
    terminal.close();
  }
}

function onPath(command: string): boolean {
  const names = process.platform === "win32" ? [`${command}.cmd`, `${command}.exe`] : [command];
  return (process.env.PATH ?? "")
    .split(path.delimiter)
    .some((folder) => folder && names.some((name) => fs.existsSync(path.join(folder, name))));
}

async function install(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { shared: { type: "boolean", default: false } } });
  try {
    const root = repoRoot();
    const installed = values.shared ? initShared(root, process.cwd()) : initPrivate(root, packageSpec());
    if (installed.mode === "team-has-it") {
      console.log("Fledgy is already installed for this repo's team. Nothing to do.");
      return 0;
    }
    console.log(
      installed.mode === "private"
        ? "Fledgy is installed for you only: git sees none of what it added."
        : "Fledgy is installed for this repo's team: commit what it added.",
    );
    console.log(`  ${installed.wrote.join("  ")}`);
    if (installed.mode === "shared" && installed.privateRemoved) {
      console.log("Your private install is gone, and knowledge-base/ is no longer hidden from git, so it can be committed.");
    }
    // A private install's binary is not where `npx` looks: the Builder runs
    // it through its git alias.
    const view =
      installed.mode === "private"
        ? "git fledgy view"
        : `npx fledgy view${installed.installedIn ? ` in ${installed.installedIn.split(path.sep).join("/")}/` : ""}`;
    await offerToMap({
      where: fs.realpathSync(process.cwd()) === fs.realpathSync(root) ? "here" : "at the repo root",
      view,
      ask: process.stdin.isTTY && process.stdout.isTTY ? ask : undefined,
      claudeOnPath: onPath("claude"),
      mapped: fs.existsSync(path.join(root, "knowledge-base")),
      print: (text) => console.log(text),
      openClaude: () => {
        spawnSync("claude", ["/map-the-app"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
      },
    });
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

function remove(): number {
  try {
    const root = repoRoot();
    const { removed, knowledgeBase, sharedPackageIn, commandKeptFor } = uninstall(root, process.cwd());
    console.log(removed.length === 0 ? "Fledgy was not installed here. Nothing to do." : "Fledgy is removed.");
    if (removed.length > 0) console.log(`  ${removed.join("  ")}`);
    if (commandKeptFor) console.log(`git fledgy is kept: the private install in ${commandKeptFor} uses it.`);
    if (knowledgeBase) {
      const hidden = removed.includes(".fledgy/") ? ", still hidden from git" : "";
      console.log(`knowledge-base/ is kept${hidden}. To delete it: rm -rf knowledge-base`);
    }
    const results = qaResultsFile(root, os.homedir());
    if (results && fs.existsSync(results)) {
      console.log(`Your QA Results are kept in ${path.dirname(results)}. To delete them: rm -rf "${path.dirname(results)}"`);
    }
    if (sharedPackageIn !== undefined) {
      console.log(`Fledgy is still in the app's package.json: run \`npm uninstall fledgy\`${sharedPackageIn ? ` in ${sharedPackageIn}/` : ""}.`);
    }
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

// Run by Claude Code, which says on stdin whether it already sent the agent
// back, and reads the answer from stdout.
async function answerStop(): Promise<void> {
  const { stop_hook_active } = JSON.parse(fs.readFileSync(0, "utf8")) as { stop_hook_active?: boolean };
  const answer = await stopHook(repoRoot(), stop_hook_active === true);
  if (answer) console.log(JSON.stringify(answer));
}

const [command, ...args] = process.argv.slice(2);
if (command === "check") {
  process.exitCode = await check();
} else if (command === "view") {
  await view(args);
} else if (command === "init") {
  process.exitCode = await install(args);
} else if (command === "uninstall") {
  process.exitCode = remove();
} else if (command === "stop-hook") {
  await answerStop();
} else {
  console.error(
    "Usage: fledgy init [--shared]\n       fledgy uninstall\n       fledgy check\n       fledgy view [--port <number>]",
  );
  process.exitCode = 2;
}
