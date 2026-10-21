import { execFileSync, spawn } from "node:child_process";

// Literal pathspecs keep names such as app/[id]/page.tsx literal. Reads never
// refresh the app's index, even when git status would normally do so.
export function readGit(root: string, ...args: string[]): string {
  return execFileSync("git", ["--no-optional-locks", "--literal-pathspecs", ...args], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024,
  });
}

// One process reads all file versions and Knowledge base trees for a request.
// The History store's objects can be read by hash through an alternate, without
// writing an alternates file or any other file in the app's .git.
function openObjects(root: string, alternate?: string) {
  const child = spawn("git", ["cat-file", "--batch"], { cwd: root, env: {
    ...process.env,
    ...(alternate ? { GIT_ALTERNATE_OBJECT_DIRECTORIES: [alternate, process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES].filter(Boolean).join(process.platform === "win32" ? ";" : ":") } : {}),
  }, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = Buffer.alloc(0);
  const waiting: { resolve: (value: Buffer | undefined) => void; reject: (error: Error) => void }[] = [];
  let failure: Error | undefined;
  const fail = (error: Error) => { failure = error; for (const entry of waiting.splice(0)) entry.reject(error); };
  child.on("error", fail);
  child.on("close", () => { if (waiting.length) fail(new Error("git cat-file ended before answering")); });
  child.stderr.resume();
  child.stdin.on("error", fail);
  child.stdout.on("data", (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    while (waiting.length) {
      const newline = buffer.indexOf(10);
      if (newline < 0) break;
      const header = buffer.subarray(0, newline).toString("utf8");
      if (header.endsWith(" missing")) {
        buffer = buffer.subarray(newline + 1);
        waiting.shift()!.resolve(undefined);
        continue;
      }
      const size = Number(header.split(" ")[2]);
      if (!Number.isFinite(size)) { fail(new Error(`Unexpected cat-file response: ${header}`)); break; }
      if (buffer.length < newline + size + 2) break;
      const content = buffer.subarray(newline + 1, newline + 1 + size);
      buffer = buffer.subarray(newline + size + 2);
      waiting.shift()!.resolve(content);
    }
  });
  const asked = new Map<string, Promise<Buffer | undefined>>();
  return {
    get(object: string): Promise<Buffer | undefined> {
      if (/^0+$/.test(object)) return Promise.resolve(undefined);
      let pending = asked.get(object);
      if (!pending) {
        pending = new Promise((resolve, reject) => {
          if (failure) return reject(failure);
          waiting.push({ resolve, reject });
          child.stdin.write(`${object}\n`);
        });
        asked.set(object, pending);
      }
      return pending;
    },
    close() { child.stdin.end(); },
  };
}
export function gitObjects(root: string, alternate?: string) {
  let batch: ReturnType<typeof openObjects> | undefined;
  return {
    get(object: string) {
      if (/^0+$/.test(object)) return Promise.resolve(undefined);
      return (batch ??= openObjects(root, alternate)).get(object);
    },
    close() { batch?.close(); },
  };
}
export type GitObjects = ReturnType<typeof gitObjects>;
