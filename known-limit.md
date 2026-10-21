# Known limits

## A conflict resolved in a merge is not seen by "changed since"

A **QA Result** recorded on a branch that was later merged lists, as changes since it was recorded:

- the branch's own commits made after the QA Result;
- the commits made on the main branch since the branch split off.

The merge commit itself is left out, because its changes include the work the QA Result already checked.

**The limit:** when a merge conflict is resolved by hand, that edit lives only in the merge commit. If it changes code an **Anchor** points to, the **Flow** is not shown as changed since the QA Result.

**What to do:** after resolving a conflict in code a **Flow** runs through, check that Flow again.

Where it is handled: `sinceCommits` in `src/flow-changes.ts`.
