# The end of the mapping

The app is mapped when no Entry point of the Mapping record is `not looked at yet`, none names a Flow to write, and `areas.yaml` lists no Flow to write. Stopping before that is always valid: a half-mapped app passes the Deterministic Check and shows in the web view, and the Mapping record says what is left.

## Steps

1. **Look once for Entry points added since the inventory.** `git diff --name-status <the inventory's commit>` and the untracked files of `git status` give the files added, changed or deleted since. Read those files, and only those. Each new Entry point becomes a row, `not looked at yet`; the row of an Entry point that is gone is removed.
2. **When step 1 added a row**, the mapping is not over: tell the Builder how many Entry points were added and in which Areas, and carry on with `area.md`.
3. **Show the Builder the Entry points with no Flow**, one last time: one line per reason, with how many Entry points share it, and where the full list is. Ask whether the mapping can be closed.
4. **On a yes, delete `knowledge-base/mapping-record.md`** and tell the Builder in one line that the app is mapped, and that from here the `maintain-knowledge-base` skill keeps the knowledge base current after each code change.

Done when the Mapping record is deleted on the Builder's yes, or the Builder has been told what is left.
