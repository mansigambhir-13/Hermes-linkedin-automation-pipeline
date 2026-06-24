# Platform post-shape diagnosis (2026-06-03)

**Question raised:** does the system treat LinkedIn / X / Instagram the same ("image + caption") when each has its own native shape (LinkedIn = long-form body + image; X = short tweet + image; IG = image-first + short caption)?

**Verdict: the system is already platform-native where it counts. The only real gap is the *image half* (all content is text-only) — a content-production gap, not a publisher or schema bug.**

---

## The trace

### (a) Schema — `library_posts`
`id, title, platform, pillar, slot, caption, image_key, alt_text, created_at`

One `caption` field — **but `platform` is per row** (each row is a single-platform post). So `caption` holds the *platform-native body* for that row, not a shared generic caption. This is the **one-row-per-platform** content model (retained by decision; a LinkedIn essay and its X version are separate rows, bridged on demand by the **Adapt** button).

### (b) Real rows are natively shaped
| Platform | row | `caption` length | shape | `image_key` |
|---|---|---|---|---|
| LinkedIn | `2026-06-01-articulation-gap-linkedin-47328` | **635 chars** | long-form essay (hook + paragraphs + CTA) | `NULL` |
| X | `2026-06-01-brief-roulette-x-karnataka-bike-taxis` | **253 chars** | short punchy tweet | `NULL` |

The content is **not shape-flat** — LinkedIn carries an essay, X carries a tweet.

### (c) Publisher mapping (`PostizPublisher`)
```ts
value: [{ content: sanitizeCaption(req.caption), image: images }]
settings: postizSettings(<platform __type>)
```
- `caption → Postiz "content"` = **the post body** (what renders as the post), NOT alt text.
- The LinkedIn 635-char essay ships as the LinkedIn post body; the X 253-char tweet ships as the tweet. No truncation, no mis-map.
- `__type` differentiates per platform; X also gets `who_can_reply_post`; `image` is always an array.
- Alt text is a separate field (`req.altTexts` → per-image `altText`).

### Validator + preview
- `validatePost` differentiates per platform (X ≤280, LinkedIn 150–600 words, IG visual-first, link/hashtag rules) and returns a `platformFit` verdict. Verified live: the X Karnataka post → `fits (x)`; adapted to LinkedIn → 1,086-char essay → `fits (linkedin)`.
- The picker review card renders the full `caption` (the body), not a reduced "image + caption."

---

## Which of the three hypotheses?
- **Publisher truncates body / maps to alt-text:** ❌ false — `caption → content` (body), per platform.
- **Source content shape-flat:** ❌ false — LinkedIn row = essay, X row = tweet.
- **Real gap:** ✅ **images.** Every row is `image_key = NULL` (text-only). So each shape is currently *"native body, no image"* — the *"+ image"* half is absent because no images were produced. The publisher already attaches an image when `image_key` is set (→ Supabase Storage URL → Postiz). This is the **Phase 1 "awaiting content"** item, not an engineering bug.

## Decisions
- **Content model: one-row-per-platform — retained.** Revisit a multi-platform "idea" row (`linkedin_body` + `x_body` + `ig_caption` in one row) only if cross-adapting >50% of posts after a few weeks of operation.
- **Fix for the perceived gap = produce images** for the posts (and the IG unlock, which mandates media) — content work, no schema/publisher change.

No code was changed as part of this diagnosis.
