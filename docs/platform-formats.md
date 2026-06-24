# Platform format spec — the native shape each platform MUST ship in

These are the rules the pipeline enforces (parser → review card → publisher) so no post ever ships incomplete. Loaded into the agent's context so Re-evaluate / Adapt reason from the same spec.

## LinkedIn — post + image
- **Body:** long-form (150–600 words): a one-line hook, then short structured paragraphs, CTA, 3–5 hashtags.
- **Image:** recommended, not mandatory. A text-only LinkedIn post is allowed (it's a valid native shape).
- **Ship rule:** the full body always; attach the image if the post has one.

## Instagram — caption + image(s) (image REQUIRED)
- **Image:** mandatory — Instagram cannot publish without media. Single image or carousel.
- **Caption:** SHORT and secondary; the carousel/image carries the message (per the brief, most readers never read the caption). A hook + at most a line or two, then one approved CTA + hashtags. The data point, the named phrase, and the reveal belong **on the slides**, not the caption.
- **Validator note:** do NOT mark a tight IG caption as "incomplete" for omitting the phrase/number/reveal that lives on the slides — that is correct IG structure. A big, fully-evidenced IG caption is the error, not the fix.
- **Ship rule:** **never publish an IG post without an image.** Block it; flag it in the picker.

## X (Twitter) — thread + image
- **Thread:** an X post may be a single tweet OR a multi-tweet thread (`1/N … N/N`). Each tweet ≤ ~280 chars.
- **Image:** a lead image (on tweet 1) is common; some X posts (transcript/quote/data cards) are **image-essential** — the image carries the substance and the caption is a 2-line teaser.
- **Ship rule:** publish the **whole thread** (every tweet, in order), not just tweet 1. If the post is image-essential, **never ship it without its image.**

## Source-MD authoring conventions (what the parser reads)
- Single post body lives under one of: `## TWEET CAPTION`, `## TWEET`, `## POST COPY`, `## CAPTION`, `## Suggested caption`, as a `> blockquote`.
- A **thread** lives under `## THREAD` with `**1/N**`, `**2/N**`, … markers, each followed by a `> blockquote`. The parser captures **all** tweets.
- **`**Format:**`** declares media: if it names an image/card/carousel and does NOT say "optional", the post is **media-required** (won't publish text-only). Instagram is always media-required.

## What the pipeline guarantees (enforcement)
1. **Threads publish in full** — X threads ship as a real multi-tweet thread (Postiz multi-entry), never truncated to tweet 1.
2. **Media-required posts can't ship without media** — IG always; image-essential X/LinkedIn cards are blocked text-only, flagged in `/posts` (`⚠️ needs image`).
3. **Platform-native body** — LinkedIn ships the long-form body, X ships the tweet/thread, IG ships the short caption (already correct per the one-row-per-platform model).
