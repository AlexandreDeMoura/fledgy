# The inventory

The first session of a mapping, after its opening explanation. It ends with the Mapping record written and Areas proposed to the Builder. No Flow and no Flow to write is written in it, and `areas.yaml` is left as it is: what the Areas are is the Builder's call, and they have not made it yet.

Steps 1 to 3 read the code and nothing of `knowledge-base/`, which is first opened in step 4. Areas grouped after reading the existing ones only repeat them, and the Builder learns nothing from the agreement.

## Steps

1. **Find every Entry point by reading the code.** Find where this app declares each kind: its pages, its endpoints, its scheduled jobs and background loops, and its incoming events (webhooks, bots, queues, messages from another system). Open every file that declares one. The app's README, docs and tests tell you what the app calls things; the code tells you what exists. The Builder reviews what you find and is not asked to describe the app. Done when every file that declares a page, an endpoint, a job or an incoming event has been opened and you hold a count for each kind.
2. **Group the Entry points into Areas**, from the code alone. An Area is a coarse region of the app the Builder would name in conversation; Areas do not nest. Each gets a name, one sentence, a rough number of Flows and two or three example Flows. An Entry point that plainly serves no Actor's goal gets its reason now; when in doubt it gets an Area.
3. **Write the Mapping record**, in the format of "The Mapping record": the commit (`git rev-parse HEAD`) and the counts, `Pilot: not run`, every Area as `not gone into`, and one row per Entry point, `not looked at yet` unless step 2 gave it a reason.
4. **Place what the knowledge base already holds**, when `knowledge-base/` has Areas, Flows or Flows to write. Read `areas.yaml` and the Flow files now. Put each existing Flow and Flow to write on the rows of the Entry points it starts at. A difference is an existing Area you split, merged, renamed or reworded, or a Flow that would change Area. Nothing moves: the Builder settles each difference first.
5. **Come back with the Areas.** The message is three things and nothing else:
   - one line per Area: its name, its sentence, its rough number of Flows, its examples;
   - the differences from step 4, one line each, or one line saying there is none. An existing Area and a Flow that stay where they are is not a difference;
   - your recommendation for the first Area to go into, in a line or two with its reason: a small Area that depends little on the others.

   Say where the Mapping record is, and stop. Where you hesitated over an Entry point's Area, the row says so in the record: it is settled when that Area is gone into.

Done when every Entry point the code declares is a row of the Mapping record with an Area or a reason, the counts in its first line match the rows, the Builder has the Areas in front of them, and `areas.yaml`, `flows/` and `parts/` are as you found them.
