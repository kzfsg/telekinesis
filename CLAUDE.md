<!-- intuition:olympus:start -->
## The component map (Olympus)

This repo is indexed into a component map derived from the compiler, not from guesses.
When available, use `atlas_find` to resolve a symbol or file, then `atlas_context` for
its definition, callers, callees, or dependencies. `atlas_path` follows verified calls.
Read the cited source before editing. Check freshness and coverage; follow nextCursor
when truncated. Empty indexed results do not prove that no relationship exists.
Use text search when the index is missing, stale, or the question is about exact text.

- `olympus_map` — the visible component map and its links. Use for architecture orientation.
  Pass `focus` with a block id or name plus `depth` to see one neighbourhood.
- `olympus_entries` — for one component, the symbols other components call, with
  `path:line`. This is the "what crosses this boundary" question.
- `olympus_propose` — draw a component or a link that SHOULD exist but does not yet.
  It records an intention; it never asserts the code is there.
- `olympus_highlight` — dim the user's map to the components you are talking about.
  Use it whenever an answer names specific components; it is a gesture at their
  screen, cleared by their next click.

Blocks are `solid` when the compiler found them and `dashed` when someone only asserted
them. Anything you propose stays dashed until real code exists and the next index finds it,
so build the code as well as the proposal.

The visual map is a sampled snapshot written by the IDE. Graph retrieval tools query
the index independently of the visible map; neither captures every runtime relationship.
<!-- intuition:olympus:end -->
