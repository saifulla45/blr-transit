# Design assets

`tokens.json` is the design system in [W3C Design Tokens](https://tr.designtokens.org/format/)
format — colours for both themes, the line identities, the type scale, spacing,
radii, and the line-rail component spec.

**`app/globals.css` remains the source of truth.** This file is an export of it.
If the two disagree, the CSS is right.

## Getting this into Figma

Figma's REST API is read-only for file content — it cannot create or modify
nodes — so nothing can author a Figma file from outside Figma. These are the
routes that actually work:

**1. Tokens Studio plugin (recommended for the system itself)**
Install [Tokens Studio](https://tokens.studio/) in Figma → Import → upload
`tokens.json`. Colours become Figma variables with light/dark modes, and the
type scale becomes text styles. This gives you the foundations to design
against, not the screens.

**2. html.to.design plugin (fastest route to the actual screens)**
Run the app (`npm run dev`), then use the
[html.to.design](https://www.figma.com/community/plugin/1159123024924461424)
plugin to import `localhost:3000` and `localhost:3000/station/KGWA` as editable
Figma layers. Because the UI is already built, this is the quickest way to get
real screens on a canvas rather than redrawing them.

**3. Figma MCP server (if you want Claude reading your Figma work)**
Figma's official MCP server exists in two forms: a desktop server needing the
Figma desktop app on a Dev or Full seat of a paid plan, and a remote server
available on all seats and plans. Note the direction of travel — it is built to
pull Figma designs *into* code, which is the opposite of what we did here. It is
worth connecting if you intend to iterate in Figma and have the code follow.

## What's worth keeping if you redesign

Three decisions carry real information and should survive a visual overhaul:

- **The line rail** is a fragment of the metro map with a node at this station.
  It encodes which line and where you are. A plain coloured bar on a card would
  look similar and mean nothing.
- **Monospace for every number.** Times, fares, distances and capacities are
  compared and stacked; a proportional face makes columns of digits ragged.
- **The departure time is the largest element.** It is the one thing someone is
  reading at a glance, mid-stride.
