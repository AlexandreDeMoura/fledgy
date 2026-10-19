import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { countDefinitions } from "./symbols.js";

// A problem is either an Anchor that does not resolve, or something wrong in
// one knowledge base file, said in a sentence. `file` is the path from the
// repo root.
export type Problem =
  | { part: string; anchor: string; at: string; wrong: "file gone" | "symbol gone" | "symbol defined more than once" }
  | { file: string; wrong: string };

type Fields = Record<string, unknown>;
// One knowledge base file. `content` is undefined when the file is not valid
// YAML, which is reported when it is read.
type Doc = { id: string; file: string; content: unknown };
type Say = (wrong: string) => void;

export async function runDeterministicCheck(repoRoot: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  const sayIn =
    (file: string): Say =>
    (wrong) =>
      problems.push({ file, wrong });
  const read = (file: string): Doc | undefined => {
    if (!fs.existsSync(path.join(repoRoot, file))) return undefined;
    try {
      return { id: "", file, content: parse(fs.readFileSync(path.join(repoRoot, file), "utf8")) };
    } catch (error) {
      sayIn(file)(`not valid YAML: ${(error as Error).message.split("\n")[0]}`);
      return { id: "", file, content: undefined };
    }
  };
  // Every `.yaml` file under `folder`, with its id: its path from `folder`
  // without the extension.
  const readFolder = (folder: string): Doc[] => {
    const dir = path.join(repoRoot, folder);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".yaml"));
    return files.sort().map((file) => {
      const below = file.split(path.sep).join("/");
      return { ...read(`${folder}/${below}`)!, id: below.slice(0, -5) };
    });
  };

  const actors = idsNamedIn(read("knowledge-base/actors.yaml"), "Actor", sayIn);
  const areasFile = read("knowledge-base/areas.yaml");
  const areas = idsNamedIn(areasFile, "Area", sayIn);
  const flows = readFolder("knowledge-base/flows");
  const parts = readFolder("knowledge-base/parts");
  const written = new Set(flows.map(({ id }) => id));
  const known = {
    actors,
    areas,
    flows: written,
    flowsToWrite: flowsToWriteIn(areasFile, written, sayIn),
    parts: new Set(parts.map(({ id }) => id)),
  };

  const named = new Set<string>();
  for (const flow of flows) {
    if (flow.content !== undefined) checkFlow(flow, known, named, sayIn(flow.file));
  }
  for (const part of parts) {
    if (part.content === undefined) continue;
    const say = sayIn(part.file);
    for (const anchor of checkPart(part, say)) {
      try {
        const wrong = await whatIsWrong(repoRoot, anchor.at);
        if (wrong) problems.push({ part: part.id, anchor: anchor.label, at: anchor.at, wrong });
      } catch (error) {
        say(`Anchor "${anchor.label}": ${(error as Error).message}`);
      }
    }
    // A Flow that could not be read may be the one that names this Part.
    if (!named.has(part.id) && flows.every(({ content }) => content !== undefined)) say("no Step names this Part");
  }
  return problems;
}

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

// Says which of `names` are not filled in. True when none is missing.
function has(fields: Fields, names: string[], what: string, say: Say): boolean {
  const missing = names.filter((name) => !isText(fields[name]));
  if (missing.length > 0) say(`${what} is missing ${missing.map((name) => `\`${name}\``).join(", ")}`);
  return missing.length === 0;
}

// `actors.yaml` and `areas.yaml`: each id with its name and one sentence.
function idsNamedIn(doc: Doc | undefined, what: "Actor" | "Area", sayIn: (file: string) => Say): Set<string> {
  if (!doc || doc.content === undefined || doc.content === null) return new Set();
  const say = sayIn(doc.file);
  if (!isFields(doc.content)) {
    say(`is not a list of ${what}s by id`);
    return new Set();
  }
  for (const [id, fields] of Object.entries(doc.content)) {
    if (!isFields(fields)) say(`${what} "${id}" is missing \`name\`, \`is\``);
    else has(fields, ["name", "is"], `${what} "${id}"`, say);
  }
  return new Set(Object.keys(doc.content));
}

// The ids of the Flows to write listed under each Area of `areas.yaml`. An id
// is used once across all Areas, and an entry leaves the list the moment its
// Flow is written.
function flowsToWriteIn(doc: Doc | undefined, written: Set<string>, sayIn: (file: string) => Say): Set<string> {
  const listed = new Set<string>();
  if (!doc || !isFields(doc.content)) return listed;
  const say = sayIn(doc.file);
  const areaOf = new Map<string, string>();
  for (const [area, fields] of Object.entries(doc.content)) {
    if (!isFields(fields) || fields.flows_to_write === undefined || fields.flows_to_write === null) continue;
    if (!isFields(fields.flows_to_write)) {
      say(`\`flows_to_write\` of the Area "${area}" is not a list of Flows to write by id`);
      continue;
    }
    for (const [id, entry] of Object.entries(fields.flows_to_write)) {
      listed.add(id);
      if (!isFields(entry)) say(`Flow to write "${id}" is missing \`name\`, \`is\``);
      else has(entry, ["name", "is"], `Flow to write "${id}"`, say);
      const other = areaOf.get(id);
      if (other) say(`the Flow to write "${id}" is listed under two Areas, "${other}" and "${area}"`);
      else areaOf.set(id, area);
      if (written.has(id)) say(`the Flow to write "${id}" now has a Flow file: remove it from \`flows_to_write\``);
    }
  }
  return listed;
}

type Known = { actors: Set<string>; areas: Set<string>; flows: Set<string>; flowsToWrite: Set<string>; parts: Set<string> };

// Adds to `named` the Parts the Flow's Steps name.
function checkFlow({ id, content }: Doc, known: Known, named: Set<string>, say: Say): void {
  if (!isFields(content)) return say("is not a Flow: it has no fields");
  // A Flow's id is its file name alone, so that it can change Area.
  if (id.includes("/")) say("a Flow file sits directly under flows/, and names its Area in `area`");
  has(content, ["name", "area", "actor", "goal", "trigger", "outcome"], "the Flow", say);
  if (isText(content.actor) && !known.actors.has(content.actor)) {
    say(`names the Actor "${content.actor}", which is not in actors.yaml`);
  }
  if (isText(content.area) && !known.areas.has(content.area)) {
    say(`names the Area "${content.area}", which is not in areas.yaml`);
  }

  checkPreconditions(content.preconditions, known, say);

  const steps = checkPath("the main path", content, known, named, say);
  const { variants = [] } = content;
  if (!Array.isArray(variants)) return say("`variants` is not a list");
  const seen = new Set<string>();
  variants.forEach((variant, index) => {
    if (!isFields(variant) || !isText(variant.id)) return say(`Variant ${index + 1} is missing \`id\``);
    const what = `Variant "${variant.id}"`;
    if (seen.has(variant.id)) say(`two Variants have the id "${variant.id}"`);
    seen.add(variant.id);
    has(variant, ["name", "diverges_at", "when", "outcome"], what, say);
    if (isText(variant.diverges_at) && !steps.has(variant.diverges_at)) {
      say(`${what} diverges at "${variant.diverges_at}", which is not a Step of the main path`);
    }
    checkPath(what, variant, known, named, say);
  });
}

// A precondition is a sentence, or names a Flow with `flow` (written) or
// `flow_to_write` (not written yet), and says with `so_that` what it leaves.
function checkPreconditions(preconditions: unknown, known: Known, say: Say): void {
  if (preconditions === undefined || preconditions === null) return;
  if (!Array.isArray(preconditions)) return say("`preconditions` is not a list");
  preconditions.forEach((precondition, index) => {
    if (isText(precondition)) return;
    const what = `precondition ${index + 1}`;
    if (!isFields(precondition) || isText(precondition.flow) === isText(precondition.flow_to_write)) {
      return say(`${what} is neither a sentence nor one of \`flow\` and \`flow_to_write\` with \`so_that\``);
    }
    has(precondition, ["so_that"], what, say);
    const { flow, flow_to_write: toWrite } = precondition;
    if (isText(flow) && !known.flows.has(flow)) say(`${what} names the Flow "${flow}", which has no file`);
    if (!isText(toWrite)) return;
    if (known.flows.has(toWrite)) {
      say(`${what} waits for the Flow "${toWrite}" with \`flow_to_write\`, and that Flow now has a file: write \`flow: ${toWrite}\``);
    } else if (!known.flowsToWrite.has(toWrite)) {
      say(`${what} waits for the Flow to write "${toWrite}", which is not under \`flows_to_write\` of any Area in areas.yaml`);
    }
  });
}

// One way through a Flow, the main path or a Variant: its Steps and its
// Manual QA Check. Returns the ids of its Steps.
function checkPath(what: string, { steps, qa }: Fields, known: Known, named: Set<string>, say: Say): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(steps) || steps.length === 0) say(`${what} has no Steps`);
  else {
    steps.forEach((step, index) => {
      if (!isFields(step) || !isText(step.id)) return say(`Step ${index + 1} of ${what} is missing \`id\``);
      const which = `Step "${step.id}" of ${what}`;
      if (ids.has(step.id)) say(`${what} has two Steps with the id "${step.id}"`);
      ids.add(step.id);
      if (!isText(step.does) && !isText(step.sees) && !isText(step.system)) {
        say(`${which} has none of \`does\`, \`sees\`, \`system\``);
      }
      const { parts = [] } = step;
      if (!Array.isArray(parts) || !parts.every(isText)) return say(`${which}: \`parts\` is not a list of Part ids`);
      for (const part of parts) {
        named.add(part);
        if (!known.parts.has(part)) say(`${which} names the Part "${part}", which has no file`);
      }
      if (isText(step.system) && parts.length === 0) say(`${which} says what the system does and names no Part`);
    });
  }

  if (qa === undefined || qa === null) say(`${what} has no Manual QA Check (\`qa\`)`);
  else {
    const check = `the Manual QA Check of ${what}`;
    if (!isFields(qa)) say(`${check} has no fields`);
    else {
      if (!Array.isArray(qa.setup) || !qa.setup.every(isText)) say(`${check}: \`setup\` is not a list of sentences`);
      if (!Array.isArray(qa.steps) || qa.steps.length === 0) say(`${check} has no steps`);
      else {
        // A QA Result attaches to a QA Step by this id.
        const seen = new Set<string>();
        qa.steps.forEach((step, index) => {
          if (!isFields(step) || !isText(step.id)) return say(`QA Step ${index + 1} of ${check} is missing \`id\``);
          if (seen.has(step.id)) say(`${check} has two QA Steps with the id "${step.id}"`);
          seen.add(step.id);
          has(step, ["do", "expect"], `QA Step "${step.id}" of ${check}`, say);
        });
      }
    }
  }
  return ids;
}

// Returns the Anchors that are well formed, to be looked for in the code.
function checkPart({ content }: Doc, say: Say): { label: string; at: string }[] {
  if (!isFields(content)) {
    say("is not a Part: it has no fields");
    return [];
  }
  has(content, ["name", "is"], "the Part", say);
  const { entity, relations, anchors } = content;
  // An Entity is a Part with `entity: true`; only an Entity has `relations`.
  const wellFormed = entity === undefined || typeof entity === "boolean";
  if (!wellFormed) say("the Part: `entity` is neither true nor false");
  if (relations !== undefined && relations !== null) {
    if (!Array.isArray(relations) || !relations.every(isText)) say("the Part: `relations` is not a list of sentences");
    if (wellFormed && entity !== true) say("the Part has `relations` and is not an Entity (`entity: true`)");
  }
  if (!Array.isArray(anchors) || anchors.length === 0) {
    say("the Part has no Anchor");
    return [];
  }
  return anchors.flatMap((anchor, index) => {
    const what = isFields(anchor) && isText(anchor.label) ? `Anchor "${anchor.label}"` : `Anchor ${index + 1}`;
    if (!isFields(anchor) || !has(anchor, ["label", "at"], what, say)) return [];
    if (anchor.side !== "screen" && anchor.side !== "backend") say(`${what}: \`side\` is neither screen nor backend`);
    return [{ label: anchor.label as string, at: anchor.at as string }];
  });
}

// An Anchor's `at` is `path#Symbol`, the path from the repo root. Without a
// symbol, only the file is checked.
async function whatIsWrong(repoRoot: string, at: string) {
  const [file = "", symbol] = at.split("#");
  const full = path.join(repoRoot, file);
  if (!fs.existsSync(full)) return "file gone" as const;
  if (!symbol) return undefined;
  const count = await countDefinitions(full, symbol);
  if (count === 0) return "symbol gone" as const;
  if (count > 1) return "symbol defined more than once" as const;
  return undefined;
}
