# Dhivehi Slide Studio

A single-page web app for Dhivehi (Thaana) PowerPoint decks.

- **Write with AI** – give a title and your information (Dhivehi or English), and/or upload a document: PDF (sent to the AI whole, up to 3 MB), Word (.docx), PowerPoint (.pptx) or text. An AI model writes the slides in formal Dhivehi and opens them in the editor.
- **Edit slides** – write slides in Dhivehi, preview them live, and download a `.pptx` whose text is already right-to-left, with **MV Aaamu FK** (aammufkF) for headings and **Faruma** for body text.
- **Fix a deck** – upload any `.pptx` and get it back with right-to-left Dhivehi paragraphs, complex-script fonts set, the theme's Thaana font replaced, and stray direction marks removed.
- Phonetic Thaana keyboard, three colour themes, five slide layouts, drafts kept in the browser.

Editing, building and fixing decks runs in the browser; .pptx files are never uploaded. Only the title and information you submit to **Write with AI** are sent to the Anthropic API.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole app (HTML, CSS, JS) |
| `fonts/` | Faruma and MV Aaamu FK, used for the preview and the "Save font files" button |
| `api/generate.js` | Serverless function that calls the Anthropic API for **Write with AI** |
| `vercel.json` | Hosting settings for Vercel |

## Deploy

No build step. On Vercel: import this repo, framework preset **Other**, leave build command and output directory empty.

### Set up Write with AI

In Vercel → Project → Settings → Environment Variables, add:

| Name | Value | Required |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com | Yes |
| `APP_PASSCODE` | Any phrase; users must enter it to use the AI | Recommended for a public site |
| `ANTHROPIC_MODEL` | Model ID, default `claude-sonnet-5-5` | No |

Redeploy after adding them. The key stays on the server and is never sent to the browser.

## Note

The `.pptx` files reference the fonts by name; they don't embed them. Install Faruma and MV Aaamu FK on any computer that presents the deck.
