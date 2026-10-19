import { expect, test } from "vitest";
import { type FirstRun, offerToMap } from "./first-run.js";

const next =
  "Next: open Claude Code here and type /map-the-app\n" +
  "Then: git fledgy view, to read what it writes.   Guide: https://github.com/AlexandreDeMoura/fledgy/tree/main/docs";

// A Builder who just ran init in a terminal, with Claude Code installed and
// nothing mapped yet, answering the question with `answer`.
function builder(answer: string | undefined, situation: Partial<Pick<FirstRun, "claudeOnPath" | "mapped">> = {}) {
  const seen = { asked: [] as string[], printed: [] as string[], claudeOpened: 0 };
  const run: FirstRun = {
    where: "here",
    view: "git fledgy view",
    ask:
      answer === undefined
        ? undefined
        : async (question) => {
            seen.asked.push(question);
            return answer;
          },
    claudeOnPath: true,
    mapped: false,
    print: (text) => seen.printed.push(text),
    openClaude: () => seen.claudeOpened++,
    ...situation,
  };
  return { run, seen };
}

test("Enter opens Claude Code on /map-the-app", async () => {
  const { run, seen } = builder("");

  await offerToMap(run);

  expect(seen.asked).toEqual(["\n? Map the app now in Claude Code? (Y/n) "]);
  expect(seen.claudeOpened).toBe(1);
  expect(seen.printed).toEqual([]);
});

test("y opens Claude Code too, and n says what to do next instead", async () => {
  const yes = builder("Y");
  const no = builder("n");

  await offerToMap(yes.run);
  await offerToMap(no.run);

  expect(yes.seen.claudeOpened).toBe(1);
  expect(no.seen.claudeOpened).toBe(0);
  expect(no.seen.printed).toEqual([`\n${next}`]);
});

test("nothing is asked when there is no terminal, no Claude Code, or a knowledge base already", async () => {
  for (const { run, seen } of [builder(undefined), builder("", { claudeOnPath: false }), builder("", { mapped: true })]) {
    await offerToMap(run);

    expect(seen.asked).toEqual([]);
    expect(seen.claudeOpened).toBe(0);
    expect(seen.printed).toEqual([`\n${next}`]);
  }
});
