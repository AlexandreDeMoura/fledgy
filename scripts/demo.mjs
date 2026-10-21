// A made-up app to try the web view by hand: `npm run demo`.
// It writes "Pantry", a small recipes app, to a temp folder: its code, a knowledge base that passes
// the check, a git history and QA Results, then serves the web view on it. Each run starts afresh.
//
// What it sets up, so each state of the view has something to show:
// - two Areas with Flows, one with only Flows to write, two of them waited for by a written Flow;
// - Variants, an Entity, Parts on both sides, Steps with no Part;
// - "Find a recipe" last changed 40 commits back, and with code not committed;
// - "Create a recipe" with a failed step, a step that could not be performed, and a commit since.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startView } from "../dist/view.js";

const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4174;
const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fledgy-demo-")), "pantry");
fs.mkdirSync(root);
const home = fs.mkdtempSync(path.join(os.tmpdir(), "fledgy-demo-home-"));
const git = (args, env = {}) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } }).trim();
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
// A commit made `daysAgo` days back, so the view has dates to show.
const commit = (message, daysAgo = 0) => {
  const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  git(["add", "--all"]);
  git(["-c", "user.name=Demo", "-c", "user.email=demo@example.com", "commit", "--quiet", "--allow-empty", "-m", message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
};

// ---------- the code ----------

const code = {
  "web/src/recipes/page.tsx": `export function RecipesPage() {
  return <RecipeList />;
}
`,
  "web/src/recipes/recipe-editor.tsx": `export function RecipeEditor() {
  return <form>{/* name, ingredients, steps */}</form>;
}

export function EmojiPicker() {
  return <div />;
}
`,
  "web/src/recipes/recipe-list.tsx": `export function RecipeList() {
  return <ul>{/* one row per recipe */}</ul>;
}

export function SearchBox() {
  return <input placeholder="Search recipes…" />;
}
`,
  "backend/app/recipes/router.py": `def create_recipe(user, draft):
    require_role(user, "cook")
    return save(draft)


def list_recipes(user, text=""):
    return [r for r in all_recipes() if text.lower() in r.name.lower()]
`,
  "backend/app/recipes/models.py": `class Recipe:
    name: str
    owner_id: int
`,
  "backend/app/auth/roles.py": `def require_role(user, role):
    if user.role < role:
        raise PermissionError(role)
`,
  "README.md": "# Pantry\n",
};

// ---------- the knowledge base ----------

const kb = {
  "knowledge-base/actors.yaml": `cook:
  name: Cook
  is: A signed-in user who writes recipes and cooks from them.
guest:
  name: Guest
  is: Someone who opens a shared recipe without an account.
`,
  "knowledge-base/areas.yaml": `recipes:
  name: Recipes
  is: Writing a recipe, finding it again and sharing it.
  flows_to_write:
    edit-a-recipe:
      name: Edit a recipe
      is: A Cook opens one of their recipes, changes its name, ingredients or steps, and saves.
    share-a-recipe:
      name: Share a recipe
      is: A Cook makes a link to one of their recipes that anyone can open without an account.
    delete-a-recipe:
      name: Delete a recipe
      is: A Cook deletes one of their recipes after confirming, and it leaves their list.
sign-in:
  name: Sign-in
  is: Getting into Pantry with an email link.
  flows_to_write:
    sign-in:
      name: Sign in
      is: Someone types their email, opens the link Pantry sends, and lands on their recipes.
`,
  "knowledge-base/parts/cook-role.yaml": `name: Cook role
is: Lets only signed-in Cooks write recipes, and tells anyone else why they cannot.
anchors:
  - label: The check that refuses a request from someone who is not a Cook
    at: backend/app/auth/roles.py#require_role
    side: backend
  - label: The page that holds the New recipe button
    at: web/src/recipes/page.tsx#RecipesPage
    side: screen
`,
  "knowledge-base/parts/recipe-editor.yaml": `name: Recipe editor
is: The form where a recipe gets its name, its ingredients, its steps and its emoji.
anchors:
  - label: The form and its Save button
    at: web/src/recipes/recipe-editor.tsx#RecipeEditor
    side: screen
  - label: The emoji picker
    at: web/src/recipes/recipe-editor.tsx#EmojiPicker
    side: screen
`,
  "knowledge-base/parts/recipe-save.yaml": `name: Recipe save
is: Stores a new recipe with everything in its form at once, or nothing if one field is refused.
anchors:
  - label: The request that stores the recipe
    at: backend/app/recipes/router.py#create_recipe
    side: backend
`,
  "knowledge-base/parts/recipe.yaml": `name: Recipe
entity: true
is: A dish a Cook wrote down, with its ingredients and its steps.
relations:
  - belongs to one Cook, its owner
  - may be shared through one link
anchors:
  - label: The stored recipe
    at: backend/app/recipes/models.py#Recipe
    side: backend
`,
  "knowledge-base/parts/recipe-list.yaml": `name: Recipe list
is: Shows a Cook their recipes, newest first, and narrows them to the ones whose name has the typed text.
anchors:
  - label: The list on the Recipes page
    at: web/src/recipes/recipe-list.tsx#RecipeList
    side: screen
  - label: The search box above it
    at: web/src/recipes/recipe-list.tsx#SearchBox
    side: screen
  - label: The request that lists and filters the recipes
    at: backend/app/recipes/router.py#list_recipes
    side: backend
`,
  "knowledge-base/flows/create-a-recipe.yaml": `name: Create a recipe
area: recipes
actor: cook
goal: Have a new recipe in Pantry, with its ingredients and steps, that the Cook owns.
trigger: The Cook clicks New recipe on the Recipes page.
outcome: The recipe exists, owned by the Cook, and its page is open.
preconditions:
  - flow_to_write: sign-in
    so_that: The Cook is signed in.
steps:
  - id: open
    does: Clicks New recipe at the top of the Recipes page.
    sees: An empty form opens, with a 🍲 emoji, the fields Name and Ingredients, and a Steps list with one empty step.
    system: The page lets a Cook through to the form.
    parts: [cook-role, recipe-editor]
  - id: fill
    does: Types a name and at least one ingredient, and may pick another emoji.
    sees: Save becomes clickable once the name and one ingredient are filled.
  - id: save
    does: Clicks Save.
    sees: The button reads "Saving…".
    system: The system checks the user is a Cook, then stores the recipe and everything in the form in one go, with the user as its owner.
    parts: [cook-role, recipe-save, recipe]
  - id: land
    sees: The recipe's page opens, with its name, its ingredients and its steps.
    system: The system loads the recipe and finds the user is its owner.
    parts: [recipe, recipe-editor]
qa:
  setup:
    - Sign in as a Cook.
    - Open Recipes from the sidebar.
  steps:
    - id: open
      do: Click New recipe.
      expect: An empty form opens with a 🍲 emoji and one empty step.
    - id: name
      do: Type "Leek soup" as the name.
      expect: Save stays greyed out.
    - id: ingredient
      do: Type "2 leeks" as the first ingredient.
      expect: Save can now be clicked.
    - id: emoji
      do: Click the emoji and pick 🥣.
      expect: The form shows 🥣.
    - id: save
      do: Click Save.
      expect: The page of "Leek soup" opens, with "2 leeks" under Ingredients.
variants:
  - id: guest-refused
    name: A Guest clicks New recipe
    diverges_at: open
    when: The person clicking New recipe is not signed in as a Cook.
    outcome: No form opens and no recipe is created.
    steps:
      - id: refused
        does: Clicks New recipe.
        sees: A dialog says "Sign in to write recipes.", with a Sign in button.
        system: The page refuses anyone who is not a Cook.
        parts: [cook-role]
    qa:
      setup:
        - Sign out.
        - Open a shared recipe link.
      steps:
        - id: refused
          do: Click New recipe.
          expect: A dialog says "Sign in to write recipes."
  - id: cancel
    name: The Cook cancels
    diverges_at: save
    when: The Cook clicks Cancel instead of Save.
    outcome: No recipe is created and the Cook is back on the Recipes page.
    steps:
      - id: cancel
        does: Clicks Cancel, then confirms "Discard this recipe?".
        sees: The Recipes page, without the draft.
        parts: [recipe-editor]
    qa:
      setup:
        - Do steps 1 to 3 of the main path.
      steps:
        - id: cancel
          do: Click Cancel, then Discard.
          expect: The Recipes page shows, and "Leek soup" is not in the list.
  - id: save-fails
    name: The save fails
    diverges_at: save
    when: The server refuses the recipe, for example a name already used by another of the Cook's recipes.
    outcome: No recipe is created and the form stays on screen to be fixed.
    steps:
      - id: refused
        does: Clicks Save.
        sees: A red line under Name says "You already have a recipe with this name."
        system: The system refuses the recipe and stores nothing.
        parts: [recipe-save]
    qa:
      setup:
        - Have a recipe named "Leek soup" already.
        - Do steps 1 to 3 of the main path.
      steps:
        - id: refused
          do: Click Save.
          expect: A red line under Name says "You already have a recipe with this name."
`,
  "knowledge-base/flows/find-a-recipe.yaml": `name: Find a recipe
area: recipes
actor: cook
goal: Find one of their recipes by its name and open it.
trigger: The Cook opens Recipes from the sidebar.
outcome: The recipe's page is open.
preconditions:
  - flow_to_write: sign-in
    so_that: The Cook is signed in.
  - flow: create-a-recipe
    so_that: The Cook has recipes.
  - flow_to_write: share-a-recipe
    so_that: Recipes shared with the Cook show too.
steps:
  - id: open
    does: Opens Recipes from the sidebar.
    sees: Their recipes, newest first, each with its emoji and its name.
    system: The system lists the Cook's recipes.
    parts: [recipe-list]
  - id: search
    does: Types part of a name in "Search recipes…".
    sees: Only the recipes whose name has the text stay listed.
    system: The system narrows the list to the matching names, whatever the case of the letters.
    parts: [recipe-list]
  - id: pick
    does: Clicks a recipe.
    sees: The recipe's page opens.
    system: The system loads the recipe.
    parts: [recipe]
qa:
  setup:
    - Sign in as a Cook with the recipes "Leek soup" and "Pear tart".
  steps:
    - id: list
      do: Open Recipes from the sidebar.
      expect: Both recipes are listed, the newest first.
    - id: search
      do: Type "LEEK" in the search box.
      expect: Only "Leek soup" stays listed.
    - id: open
      do: Click "Leek soup".
      expect: The page of "Leek soup" opens.
variants:
  - id: none-match
    name: No recipe matches
    diverges_at: search
    when: No recipe name has the typed text.
    outcome: The list is empty and says so, and the Cook can clear the search.
    steps:
      - id: empty
        does: Types a text no recipe name has.
        sees: The list says "No recipe found", with a Clear search button.
        system: The system finds no matching name.
        parts: [recipe-list]
    qa:
      setup:
        - Sign in as a Cook with the recipe "Leek soup".
        - Open Recipes from the sidebar.
      steps:
        - id: empty
          do: Type "zzz" in the search box.
          expect: The list says "No recipe found".
        - id: clear
          do: Click Clear search.
          expect: The recipe "Leek soup" is listed again.
`,
};

// ---------- the history ----------

git(["init", "--quiet", "--initial-branch=main"]);
for (const [file, text] of Object.entries({ ...code, ...kb })) write(file, text);
commit("Start Pantry, with its knowledge base", 62);
// Commits that change no Flow, enough to push the first one out of the recent ones.
for (let n = 1; n <= 40; n++) {
  write("README.md", `# Pantry\n\nRelease ${n}.\n`);
  commit(`chore: release ${n}`, 61 - n * 1.5);
}
write("backend/app/recipes/router.py", code["backend/app/recipes/router.py"].replace("return save(draft)", "return save(draft, at_once=True)"));
commit("feat(recipes): save a recipe and its steps in one go", 0.5);

// ---------- the view, and the QA Results a Cook recorded ----------

const view = await startView(root, { port, home });
const record = (flow, pathId, step, state, note = "") =>
  fetch(new URL("/api/result", view.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow, path: pathId, step, state, note }),
  }).then((r) => r.json());

await record("create-a-recipe", "main", "open", "passed");
await record("create-a-recipe", "main", "name", "passed");
await record("create-a-recipe", "main", "ingredient", "failed", "Save stayed greyed out after typing the ingredient.");
await record("create-a-recipe", "main", "emoji", "could-not-perform", "No emoji picker in this build.");
await record("create-a-recipe", "guest-refused", "refused", "passed");
await record("find-a-recipe", "main", "list", "passed");
await record("find-a-recipe", "main", "search", "passed");

// A commit after those results changes "Create a recipe"...
write("backend/app/recipes/router.py", fs.readFileSync(path.join(root, "backend/app/recipes/router.py"), "utf8").replace("return save(draft, at_once=True)", "return save(draft.trimmed(), at_once=True)"));
commit("fix(recipes): trim the name before saving");
// ...and code not committed yet changes "Find a recipe".
write("web/src/recipes/recipe-list.tsx", code["web/src/recipes/recipe-list.tsx"].replace("{/* one row per recipe */}", "{/* one row per recipe, with its emoji */}"));

console.log(`Pantry, a made-up app, is at ${root}
Its QA Results are kept apart from yours, in ${home}

Open ${view.url}
Edit its files, commit in it, record results: the view reads them again when the window comes back to the front.
Ctrl+C to stop. Each run starts a new Pantry.`);
