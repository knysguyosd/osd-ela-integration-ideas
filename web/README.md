# Web interface — CKLA ↔ Utah Standards Integration Finder

A static site skinned to the Ogden School District brand (deep navy `#0F2065`,
gold `#F3D24F`, Playfair Display / Source Sans 3 / JetBrains Mono), following
`OSD_Design_Guide.md` in the project root. No server and no build tools required.

Two themes share the brand, switched by the header toggle and remembered per
browser (localStorage): **light** (default — white surfaces, navy headings,
green/rose functional badges) and **dark** (the design guide's layered
navy-black presentation style). The navy header and footer are constant across
both. Printing always uses the light, binder-friendly layout regardless of theme.

**Accessibility:** an A− / A / A+ control in the header scales the whole
interface (16 / 18 / 20px root size — everything is rem-based), remembered per
browser like the theme. Compact (16px) is the default; the standard setting
matches the design guide's 18px body-text minimum. Relative sizes keep a
raised floor throughout — badges and labels never drop to tiny print.

One asset loads from the internet and fails gracefully offline: Google Fonts
(falls back to Georgia/Segoe UI/Consolas). Everything else — including all
data — is local. There is deliberately no district logo in the header: the site
is meant to be embedded inside the district's website, which already carries it.

## Publishing to the district website (Thrillshare/Apptegy)

Thrillshare's file library only accepts certain file types (.html, .md — not
.css/.js), so the four-file folder can't be uploaded as-is. Two options:

**Option A — single-file upload (no outside services).** Build the everything-
in-one-file version and upload just that one HTML file to Thrillshare:

```
python scripts/build_web_data.py          # refresh data.js from data/
python scripts/build_single_file.py       # -> web/ckla-integration-finder.html (~550 KB)
```

Upload `ckla-integration-finder.html`, copy its hosted URL, and embed it in a
page with an iframe (Thrillshare custom-embed block), e.g.:

```html
<iframe src="PASTE-HOSTED-FILE-URL-HERE"
        style="width:100%; height:1400px; border:none;"
        title="CKLA Utah Standards Integration Finder"></iframe>
```

Each data update means re-running both scripts and re-uploading the file.

**Option B — free static host + iframe.** Put the `web/` folder on GitHub Pages
(or Netlify/Cloudflare Pages), then iframe that URL from a Thrillshare page the
same way. Updates become "push the new data.js" instead of re-uploading, and
the URL never changes. Requires district approval of an external host.

The layout is responsive and works at embed widths in both options.

## Run it

Double-click `index.html` (or open it in any browser). That's it.

To share: copy the whole `web/` folder to a shared drive, or upload it to any
static host (district web space, GitHub Pages, Netlify). All four files must
travel together: `index.html`, `styles.css`, `app.js`, `data.js`.

## Update the data

`data.js` is generated from the JSON in `data/`. After editing lessons,
standards, or integration records (e.g., flipping `status` from `draft` to
`approved` during curation), regenerate it:

```
python scripts/build_web_data.py
```

The script validates every integration's `lesson_id` and `standard_code`
against the lesson and standards files and refuses to build on errors
(details land in `web/build_report.txt`). Reload the browser to see changes.

Records with `status: "rejected"` are excluded from the site everywhere
(cards, counts, coverage stats) — no need to delete them from the JSON.

## What's in the app

- **Home** — coverage stats, legend for the two match axes / depth scale / curation status, unit cards.
- **Units → Lessons** — unit overview (big ideas, writing project), lesson list with SS/CS idea counts.
- **Lesson pages** — primary focus, lesson-at-a-glance schedule, summary, topics, vocab, student work, and the integration cards. The **Print one-pager** button produces a planning-binder page (collapsed sections auto-expand for printing).
- **Standards browser** — every Utah 5th-grade SS and CS standard grouped by strand/concept, with coverage counts; uncovered standards are flagged **Gap** (they need standalone instruction).
- **Standard pages** — full standard text plus every lesson that reaches it.
- **Search** — lessons (title, topics, summary, student work, vocab), standards, and integration ideas.
- **Filters** (subject / match type / depth / status) apply to every integration-card list and persist while you browse.
