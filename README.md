# JustSite — Bootstrap 5 Components Generator (MVP)

Use Bitcount Single typography and a futuristic experience for the demo site (preloader, starfield parallax, 3D cards). This repository also ships a CLI generator that converts Bootstrap 5 HTML fragments into Handlebars components with editable fields and metadata.

Key links and references:
- Product vision: https://just-site.win — Make it simple
- Inspiration: https://cursor.com/ • https://www.trae.ai/ • Behance futurism concepts

## What you get
- HTML → Handlebars (.hbs) conversion
- fields.json with a clean schema for editor fields
- meta.json with library metadata
- Automatic saving to a library folder structure: `library/<category>/<slug>/`
- No custom CSS classes in generated components (MVP) — Bootstrap 5 only

## Folder structure
```
/library
  /marketing
    /hero
      /hero-basic
        index.hbs
        fields.json
        meta.json
/tools
  html-to-hbs.js
/examples
  hero-basic.json
```

## CLI usage
The generator is dependency-free (Node.js only). Input JSON format:

```
{
  "componentName": "Hero Basic",
  "category": "marketing/hero",
  "tags": ["hero", "landing", "marketing"],
  "sourceHtml": "<section class=\"py-5 bg-light\"><div class=\"container text-center\"><h1>Build fast</h1><p class=\"lead\">Ship websites with prebuilt blocks.</p><a class=\"btn btn-primary btn-lg\" href=\"#\">Get started</a></div></section>",
  "options": {
    "classesMode": "single|multiple|fixed",
    "textEditable": true,
    "attrEditable": ["href", "src", "alt", "title"]
  }
}
```

Run:
- node tools/html-to-hbs.js --input ./examples/hero-basic.json
- Or pipe JSON: `cat examples/hero-basic.json | node tools/html-to-hbs.js`

Outputs into: `library/marketing/hero/hero-basic/`

## Conventions
- Variable naming: snake_case
  - Content: `title`, `subtitle`, `btn_label`, `btn_url`, `img_src`, `img_alt`, `img_title`
  - Classes: one slot per container: `section_classes`, `container_classes`, `btn_classes`
- Attributes: if editable (`href`, `src`, `alt`, `title`) → replaced with `{{var}}`
- Text nodes → variables; long/HTML-rich content would use triple-stache `{{{rich_text}}}` (reserved for a future version)
- Accessibility: keep `aria-*`/`role` attributes intact
- No inline styles; prefer Bootstrap 5 classes

## Schema formats
- fields.json
```
{
  "$schema": "https://justsite.dev/schemas/fields.schema.json",
  "version": "1.0.0",
  "fields": [
    { "key": "title", "type": "text", "label": "Заголовок", "default": "Build fast" },
    { "key": "subtitle", "type": "text", "label": "Подзаголовок", "default": "Ship websites with prebuilt blocks." },
    { "key": "btn_label", "type": "text", "label": "Текст кнопки", "default": "Get started" },
    { "key": "btn_url", "type": "url", "label": "Ссылка кнопки", "default": "#" },
    { "key": "section_classes", "type": "classes", "label": "Классы секции", "default": "py-5 bg-light" },
    { "key": "container_classes", "type": "classes", "label": "Классы контейнера", "default": "container text-center" },
    { "key": "btn_classes", "type": "classes", "label": "Классы кнопки", "default": "btn btn-primary btn-lg" }
  ]
}
```

- meta.json
```
{
  "name": "Hero Basic",
  "slug": "hero-basic",
  "category": "marketing/hero",
  "tags": ["hero", "landing", "marketing"],
  "description": "Простой hero‑блок на Bootstrap 5 с заголовком, подзаголовком и кнопкой.",
  "bootstrap": "5",
  "accessibility": { "ariaReady": true },
  "version": "1.0.0"
}
```

## Quality checklist (MVP)
- [x] HBS valid
- [x] Bootstrap 5 only (no custom classes)
- [x] All editable texts extracted into fields
- [x] meta.json populated

## Notes on the demo site
- Font: Bitcount Single (place `Bitcount-Single.woff2` in `/assets/fonts/`)
- Rich 3D/parallax, preloader, and micro-animations are already implemented in `index.html`, `styles.css`, and `script.js`

## Roadmap
- Multiple class slots with helper `classNames`
- Rich text with `{{{rich_text}}}` and sanitization
- Preview generation
- Collection templates and Canvas integration
