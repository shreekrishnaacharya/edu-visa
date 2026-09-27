# Browser QA harness

Chrome is available at `/usr/bin/google-chrome`, so the UI can be verified for
real instead of only typechecked. Both scripts log in through the API, plant the
tokens `authProvider` expects in `localStorage`, then drive pages over the Chrome
DevTools Protocol.

    # every page: renders, expected content present, console clean
    node qa/pages.mjs

    # one page, dump its visible text (for eyeballing content)
    node qa/pages.mjs /universities/<id>

    # functional: drive controls and assert the result set really changes
    node qa/interactions.mjs

Requires the API on :3000 and `npm run dev` on :5173.

Two gotchas worth keeping in mind when extending these:

- A MUI `Select` opens on `mousedown` of `.MuiSelect-select`. Clicking the hidden
  input does nothing, which reads as a broken filter when it is not.
- Don't flag "must be ..." as a validation error: real policy text contains
  sentences like "Marriage must be at least 12 months old".
