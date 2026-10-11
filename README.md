# Dhivehi Slide Studio

A single-page web app for Dhivehi (Thaana) PowerPoint decks.

- **Create a deck** – write slides in Dhivehi, preview them live, and download a `.pptx` whose text is already right-to-left, with **MV Aaamu FK** (aammufkF) for headings and **Faruma** for body text.
- **Fix a deck** – upload any `.pptx` and get it back with right-to-left Dhivehi paragraphs, complex-script fonts set, the theme's Thaana font replaced, and stray direction marks removed.
- Phonetic Thaana keyboard, three colour themes, five slide layouts, drafts kept in the browser.

Everything runs in the browser; files are never uploaded to a server.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS) |
| `fonts/` | Faruma and MV Aaamu FK, used for the preview and the "Save font files" button |
| `vercel.json` | Static hosting settings for Vercel |

## Deploy

Static site, no build step. On Vercel: import this repo, framework preset **Other**, leave build command and output directory empty.

## Note

The `.pptx` files reference the fonts by name; they don't embed them. Install Faruma and MV Aaamu FK on any computer that presents the deck.
