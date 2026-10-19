// What a Builder is offered right after `init`: to start mapping at once.
export type FirstRun = {
  // Where to open Claude Code, as the next line says it: "here" or "at the repo root".
  where: string;
  // The command that serves the web view, as the Builder types it.
  view: string;
  // Asks one question in the terminal; undefined when there is no terminal to
  // ask in, as when an agent or a script ran init.
  ask: ((question: string) => Promise<string>) | undefined;
  claudeOnPath: boolean;
  // Whether `knowledge-base/` exists already: a rerun or an upgrade.
  mapped: boolean;
  print: (text: string) => void;
  // Hands the terminal to a fresh Claude Code session at the git root, so the
  // new skills and hook are loaded, with /map-the-app as its first prompt.
  openClaude: () => void;
};

const guide = "https://github.com/AlexandreDeMoura/fledgy/tree/main/docs";

export async function offerToMap({ where, view, ask, claudeOnPath, mapped, print, openClaude }: FirstRun): Promise<void> {
  if (ask && claudeOnPath && !mapped) {
    const answer = (await ask("\n? Map the app now in Claude Code? (Y/n) ")).trim().toLowerCase();
    if (answer === "" || answer === "y" || answer === "yes") return openClaude();
  }
  print(
    `\nNext: open Claude Code ${where} and type /map-the-app\n` +
      `Then: ${view}, to read what it writes.   Guide: ${guide}`,
  );
}
