"""Shared social metadata for v5 Instagram + WhatsApp glossary cards.

BRAND  — the company / personality each glossary term is anchored to. Rendered
         as a badge ON the image and named IN the caption (per user request:
         "company name or personality should be there related to that course").
ATTR   — a short, web-verifiable attribution sentence injected into the caption
         ONLY for the two concept-cards whose brand is not already named in the
         shared explanation (anchoring, sunk-cost). For the other 11 cards the
         company/personality is already in the copy, so no injection is needed.

Brand facts (verified):
- anchoring: anchoring-and-adjustment heuristic introduced by Daniel Kahneman &
  Amos Tversky, "Judgment under Uncertainty", Science, 1974.
- sunk-cost: the "Concorde fallacy" — the Anglo-French supersonic programme kept
  funded long past its economic case because of money already spent.
"""

# slug -> company / personality badge (short, display-ready)
BRAND = {
    "anchoring": "Kahneman & Tversky",
    "credible-threat": "OpenAI × Microsoft",
    "feature-debt": "Instagram",
    "job-to-be-done": "Clayton Christensen",
    "network-effect": "WhatsApp",
    "outcome-mapping": "Amazon",
    "removal-test": "Slack",
    "rice-score": "Intercom",
    "sunk-cost": "The Concorde",
    "switching-cost": "Salesforce & SAP",
    "debeers-loss-frame": "Frances Gerety · De Beers",
    "debeers-category-belief": "De Beers",
    "debeers-message-framing": "Frances Gerety · De Beers",
}

# slug -> the "catching point": a short, vivid on-IMAGE line that names the
# company / personality. This is what makes the card likeable/shareable, so it
# sits prominently on the card (HTML, so <b> bolds the company name).
HOOK = {
    "anchoring": "<b>Kahneman &amp; Tversky</b> proved it in 1974 — the first number on the table sets the range everyone argues inside.",
    "credible-threat": "2023 — 700+ <b>OpenAI</b> staff threatened to follow Sam Altman to <b>Microsoft</b>. Nobody had to move.",
    "feature-debt": "In 2022 <b>Instagram</b> shut down its standalone Boomerang and Hyperlapse apps. Fewer things to keep alive.",
    "job-to-be-done": "<b>Clayton Christensen</b> found people don't buy a milkshake by age. They hire it for a long, boring commute.",
    "network-effect": "<b>WhatsApp</b> doesn't win on features. It wins because everyone you'd message is already on it.",
    "outcome-mapping": "<b>Amazon</b> writes the customer press release before the product exists, then works backwards.",
    "removal-test": "<b>Slack</b> stayed text-first for years, shipping built-in video only in 2016. Restraint as a feature.",
    "rice-score": "<b>Intercom</b> built RICE to settle ten people each certain their feature was the urgent one.",
    "sunk-cost": "<b>The Concorde</b> kept flying decades past its economic case. Too much already spent to stop.",
    "switching-cost": "Firms stay on <b>Salesforce</b> and <b>SAP</b> long after cheaper rivals appear. Leaving can cost a year.",
    "debeers-loss-frame": "1947 — <b>Frances Gerety</b> wrote four words for <b>De Beers</b>: A Diamond Is Forever.",
    "debeers-category-belief": "<b>De Beers</b> made the diamond ring feel like timeless tradition. The 'months' salary' rule was invented in an ad meeting.",
    "debeers-message-framing": "Four words from <b>Frances Gerety</b> moved an economy: A Diamond Is Forever.",
}

# slug -> attribution sentence, injected after the caption hook.
# Only for cards whose brand is NOT already named in the shared explanation.
ATTR = {
    "anchoring": (
        "Daniel Kahneman and Amos Tversky first measured the pull of that "
        "opening number in 1974."
    ),
    "sunk-cost": (
        "Economists named it the Concorde fallacy — the supersonic jet "
        "Britain and France kept funding for years, partly because they had "
        "already sunk so much into it."
    ),
}

# slug -> key names / companies to bold (white) in the body for scan emphasis.
# Shared by the WhatsApp and Instagram builders.
BOLD = {
    "anchoring": ["Daniel Kahneman", "Amos Tversky"],
    "credible-threat": ["OpenAI", "Sam Altman", "Microsoft"],
    "feature-debt": ["Instagram", "Boomerang", "Hyperlapse"],
    "job-to-be-done": ["Clayton Christensen", "Bob Moesta"],
    "network-effect": ["WhatsApp"],
    "outcome-mapping": ["Amazon", "Bezos"],
    "removal-test": ["Slack"],
    "rice-score": ["Intercom", "RICE"],
    "sunk-cost": ["Concorde"],
    "switching-cost": ["Salesforce", "SAP"],
    "debeers-loss-frame": ["Frances Gerety", "N.W. Ayer", "De Beers", "A Diamond Is Forever"],
    "debeers-category-belief": ["Frances Gerety", "N.W. Ayer", "De Beers"],
    "debeers-message-framing": ["Frances Gerety", "De Beers", "A Diamond Is Forever"],
}


def bolden(text: str, terms: list) -> str:
    """Wrap key names/companies in <b> (rendered white). Longest terms first so a
    longer phrase isn't broken by a shorter substring; skip anything already tagged."""
    for term in sorted(terms, key=len, reverse=True):
        if term in text and f"<b>{term}</b>" not in text:
            text = text.replace(term, f"<b>{term}</b>")
    return text
