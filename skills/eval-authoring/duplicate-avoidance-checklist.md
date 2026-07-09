# Duplicate Avoidance Checklist

Run this before authoring and again after authoring.

1. List existing non-sample fixtures under `evals/<kind>/<target>/`.
2. Search for proposed IDs and distinctive phrases from proposed titles, descriptions, and utterances.
3. Compare coverage signatures, not just names:
   - `kind`;
   - negative case;
   - route class, actions, read tools, and params;
   - policy posture, risk, effects, confirmation, resolved mode, and reason codes;
   - reversibility kind, undo request scope, expected outcome, and order;
   - cross-surface start, destination, capability wait, failure type, and preserved undo prefix.
4. Skip candidates that only paraphrase an existing fixture.
5. Keep candidates that cover a new registry-derived boundary, sibling contrast, surface path, posture/risk cell, or undo/cross-surface behavior. State that distinction in the fixture description.
6. After writing fixtures, re-run the search. New hits should be only the files just authored.
