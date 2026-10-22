import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { changeReader, type ChangedSince } from "./flow-changes.js";
import {
  noteQaResult,
  qaResultAt,
  qaResultsFile,
  readQaResults,
  recordQaResult,
  removeQaResults,
  type QaResult,
  type QaResults,
} from "./qa-results.js";

// The page is plain files with no build step, kept beside `src` and `dist`.
const pages = new URL("../view/", import.meta.url);
const served: Record<string, [file: string, type: string]> = {
  "/": ["index.html", "text/html"],
  "/view.js": ["view.js", "text/javascript"],
  "/view.css": ["view.css", "text/css"],
  "/themes.css": ["themes.css", "text/css"],
};

export type View = { url: string; close: () => Promise<void> };

type Part = { anchors?: { at: string }[] };
type Step = { id: string; does?: string; sees?: string; system?: string; parts?: string[] };
type ManualQaCheck = { setup: string[]; steps: { id?: string; do: string; expect: string }[] };
type Variant = {
  id: string;
  name: string;
  diverges_at: string;
  when: string;
  outcome: string;
  steps: Step[];
  qa: ManualQaCheck;
};
type FlowFile = { outcome: string; steps: Step[]; qa: ManualQaCheck; variants?: Variant[] };
// One way through a Flow, start to end: the main path or a Variant.
type Path = {
  id: string;
  name: string;
  outcome: string;
  steps: (Step & { shared?: true })[];
  qa: ManualQaCheck;
  when?: string;
  divergesAt?: number;
};

// Serves the web view of the knowledge base at the root of `repoRoot`. The
// files are read again on every request, so an edit shows on the next load.
// QA Results are kept under `home`, the Builder's home folder.
export async function startView(
  repoRoot: string,
  { port, home = os.homedir() }: { port: number; home?: string },
): Promise<View> {
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname.startsWith("/api/")) {
      // A file caught half-written must not stop the view: the page shows
      // the error and the next load reads again.
      try {
        const file = qaResultsFile(repoRoot, home);
        const reader = await changeReader(repoRoot, home);
        try {
          if (pathname !== "/api/data") await change(repoRoot, file, pathname, req, reader.changes);
          const kb = read(repoRoot);
          sendJson(res, 200, {
            ...kb,
            changes: reader.changes,
            results: await shown(kb, reader, readQaResults(file)),
            resultsFile: file ?? null,
          });
        } finally { reader.close(); }
      } catch (error) {
        sendJson(res, error instanceof Refused ? error.status : 500, { error: (error as Error).message });
      }
      return;
    }
    const [file, type] = served[pathname] ?? [];
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` }).end(fs.readFileSync(new URL(file, pages)));
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://localhost:${(server.address() as AddressInfo).port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const states = ["passed", "failed", "could-not-perform"] as const;

// The one thing the web view writes: a Builder's QA Results. A result is
// only taken for a QA Step the knowledge base has.
async function change(repoRoot: string, file: string | undefined, pathname: string, req: http.IncomingMessage, changes: Awaited<ReturnType<typeof changeReader>>["changes"]) {
  if (!["/api/result", "/api/note", "/api/result-reset"].includes(pathname) || req.method !== "POST")
    throw new Refused(404, "Not found.");
  // Another web page can post to this server without asking, but not as JSON.
  if (req.headers["content-type"] !== "application/json") throw new Refused(415, "Send JSON.");
  if (!file) throw new Refused(409, "QA Results need a git repo with at least one commit.");
  const { flow, path: pathId, step, state, note = "" } = await body(req);
  if (typeof note !== "string") throw new Refused(400, "A note is text.");

  const kb = read(repoRoot);
  const onPath = Object.hasOwn(kb.flows, String(flow)) ? kb.flows[flow]?.paths.find((path) => path.id === pathId) : undefined;
  if (!onPath) throw new Refused(400, `No path ${pathId} on the Flow ${flow}.`);
  if (pathname === "/api/result-reset") return removeQaResults(file, { flow, path: pathId });
  if (!onPath.qa.steps.some((qaStep) => qaStep.id === step))
    throw new Refused(400, `No QA Step ${step} on the path ${pathId} of the Flow ${flow}.`);

  const ref = { flow, path: pathId, step };
  if (pathname === "/api/note") noteQaResult(file, ref, note);
  else if (state === "not-checked") removeQaResults(file, ref);
  else if (states.includes(state)) recordQaResult(repoRoot, file, ref, changes.flows[flow]?.uncommitted ?? false, { state, note });
  else throw new Refused(400, `A QA Step is not-checked, ${states.join(", ")}.`);
}

async function body(req: http.IncomingMessage) {
  let text = "";
  for await (const chunk of req) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    throw new Refused(400, "Send JSON.");
  }
}

// The results of the QA Steps the knowledge base has now, each with what has
// happened to its Flow since. A result whose Flow, path or QA Step is gone
// stays in the file and is not shown.
async function shown(
  kb: ReturnType<typeof read>,
  reader: Awaited<ReturnType<typeof changeReader>>,
  results: QaResults,
) {
  const since = reader.sinceReader;
  const out: Record<string, Record<string, Record<string, QaResult & { since: ChangedSince }>>> = {};
  for (const [flow, content] of Object.entries(kb.flows))
    for (const path of content?.paths ?? [])
      for (const { id: step } of path.qa?.steps ?? []) {
        const result = step === undefined ? undefined : qaResultAt(results, { flow, path: path.id, step });
        if (result)
          ((out[flow] ??= {})[path.id] ??= {})[step!] = {
            ...result,
            since: await since(flow, result),
          };
      }
  return out;
}

function read(repoRoot: string) {
  const kb = (...below: string[]) => path.join(repoRoot, "knowledge-base", ...below);
  return {
    repo: { name: path.basename(repoRoot), root: repoRoot },
    actors: readYaml(kb("actors.yaml"), (actors) => actors) ?? {},
    areas: readYaml(kb("areas.yaml"), (areas) => areas) ?? {},
    flows: readById(kb("flows"), ({ outcome, steps, qa, variants, ...facts }: FlowFile) => ({
      ...facts,
      paths: paths({ outcome, steps, qa, variants }),
    })),
    parts: readById(kb("parts"), (part: Part) => part),
  };

  // Whatever goes wrong with a file, the error says which file.
  function readYaml<In, Out>(file: string, shape: (content: In) => Out): Out | undefined {
    if (!fs.existsSync(file)) return undefined;
    try {
      return shape(parse(fs.readFileSync(file, "utf8")));
    } catch (error) {
      throw new Error(`${path.relative(repoRoot, file)}: ${(error as Error).message}`);
    }
  }

  // Every `.yaml` file under `dir`, keyed by its id: its path from `dir`
  // without the extension.
  function readById<In, Out>(dir: string, shape: (content: In) => Out): Record<string, Out | undefined> {
    if (!fs.existsSync(dir)) return {};
    const files = fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".yaml"));
    return Object.fromEntries(
      files.sort().map((file) => [file.slice(0, -5).split(path.sep).join("/"), readYaml(path.join(dir, file), shape)]),
    );
  }
}

// Flow change data uses code Anchors from each commit's Knowledge base
// version; edits to Flow and Part YAML files never count as code changes.

// A Variant file holds only the Steps from where it diverges; the Steps it
// shares with the main path are put back in front, so every path reads whole.
function paths({ outcome, steps, qa, variants = [] }: FlowFile): Path[] {
  return [
    { id: "main", name: "Main path", outcome, steps, qa },
    ...variants.map(({ diverges_at, steps: own, ...variant }) => {
      const at = steps.findIndex((step) => step.id === diverges_at);
      if (at === -1) return { ...variant, steps: own };
      const shared = steps.slice(0, at).map((step) => ({ ...step, shared: true as const }));
      return { ...variant, divergesAt: at, steps: [...shared, ...own] };
    }),
  ];
}
