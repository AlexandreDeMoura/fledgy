# Fledgy

**Understand the app your agent built, without reading its code.**

Fledgy keeps a plain-words map of every user flow, the parts of the system each step runs through, and a manual QA script for each path, checked against the code after every change.

Works with Claude Code today.

## What it does

- **It explains your system through its user flows.** Each Flow is told from the side of the person using the app: what they do, what they see, what the system does. Each step names the parts of the system it runs through. You understand the app from how it is used, not from its file tree.
- **It tells you what to test, and what to retest.** Every path has a manual QA script you tick in the web view. Your results are tied to the commit you checked them on, so the view shows what changed since.
- **It stays true.** The agent reads the implementation to describe your app and updates those descriptions as it changes the code. Fledgy checks that the structure and code references hold together, shows changes since your last QA, and gives you a manual QA script for each described path.

Can the agent misunderstand something? Yes. The automated checks don’t prove the prose correct. I trust today’s coding agents with this work because the process grounds their descriptions in code and puts concrete behavior in front of me to read, question, and try.

## What it won’t do

- Explain or review your code. There are no architecture docs and no code graph.
- Replace your automated tests.
- Serve as your agent’s memory.

## Get started

You need Node 20 or later, Claude Code, and your app in a git repo.

In the repo, run:

```sh
npx fledgy init
```

Fledgy installs for you only: it puts its copy in `.fledgy/`, its skills in `.claude/skills/`, and hides all of it, and the `knowledge-base/` it will write, from git. Nothing changes for anyone else on the repo.

It then offers to open Claude Code and start mapping. Otherwise, open Claude Code at the repo's root and type `/map-the-app`, or just say *Map the app*. Fledgy reads your code, proposes the Areas of your app for you to correct, then writes their Flows with you, one Area at a time, over several sessions.

To read what it writes, run:

```sh
git fledgy view
```

| Command | What it does |
|---|---|
| `git fledgy view` | Opens the web view of the knowledge base, at http://localhost:4173 |
| `git fledgy check` | Checks the knowledge base's structure and code references |
| `npx fledgy@latest init` | Upgrades Fledgy |
| `git fledgy uninstall` | Removes Fledgy, and keeps your knowledge base |

**For a team.** To commit the knowledge base and share it, install Fledgy in the app with `npm install -D fledgy`, then run `npx fledgy init --shared` from the same folder, and commit what it adds. Running that in a private install converts it.

## Not yet

- Claude Code only.
- Web apps that can have npm, on macOS or Linux. Windows is untested.
- Code references into TypeScript, JavaScript and Python only.
- One person per machine: QA results are not shared.
- The check covers structure, not whether the words are true.
- The token cost of mapping an Area is not measured yet.

## Feedback

Fledgy is young, and feedback is the most useful thing you can give it. Report a bug in [Issues](https://github.com/AlexandreDeMoura/fledgy/issues). Ask a question, share an idea, or show what you mapped in [Discussions](https://github.com/AlexandreDeMoura/fledgy/discussions).

## License

[MIT](LICENSE)
