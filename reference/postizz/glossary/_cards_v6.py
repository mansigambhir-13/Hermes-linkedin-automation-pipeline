"""NEW glossary cards for the v6 LinkedIn green-card series.

Terms are NEW (not in the v5 set: anchoring, credible-threat, feature-debt,
job-to-be-done, network-effect, outcome-mapping, removal-test, rice-score,
sunk-cost, switching-cost, loss-frame, category-belief, message-framing — and
not the already-posted corporate-strategist terms).

Each term is pulled from an ACTIVE course on the Rehearsal production DB
(project ukulaouikahkyhiayffq, course_content.status='active'); the card body is
grounded in that course's audited `glossary.meaning` plus canonical public fact.

Schema mirrors ../_build.py CARDS: slug, course (local visuals folder), image,
headline, explanation (\\n\\n paragraphs), close (rotating CTA), hashtags.
"""

# slug -> words/phrases to bold white in the card body for scan emphasis.
# Each entry must appear in the FIRST TWO paragraphs (what the square IG card
# shows). Person/company names where they exist; otherwise the pivotal concept.
BOLD_V6 = {
    "goodharts-law": ["Charles Goodhart", "1975"],
    "crowding-out-effect": ["external incentive", "internal one"],
    "first-principles": ["Aristotle", "First-principles"],
    "idiot-index": ["SpaceX", "fifty to one"],
    "inversion": ["Charlie Munger", "guarantee failure"],
    "pre-mortem": ["Gary Klein", "already failed"],
    "keeper-test": ["Netflix", "Reed Hastings"],
    "vitality-curve": ["Jack Welch", "GE", "20-70-10"],
    "career-capital": ["Cal Newport", "career capital"],
    "kasparovs-law": ["Garry Kasparov", "2005"],
    "jagged-frontier": ["Harvard", "BCG", "jagged frontier"],
    "automation-paradox": ["Lisanne Bainbridge", "1983"],
    "center-of-gravity": ["demand-weighted middle", "ten thousand orders"],
    "dark-store": ["Blinkit", "Zepto", "Swiggy Instamart"],
    "flight-to-quality": ["US Treasuries", "gold", "Nifty", "rupee"],
    "sharpe-ratio": ["Sharpe ratio", "leverage", "hidden tail risk"],
    "tragedy-of-the-commons": ["system archetype", "collective ruin"],
    "shifting-the-burden": ["symptomatic solution", "structural fix"],
    "retrospective-taxation": ["Vodafone", "Hutchison", "2012"],
    "weighted-distribution": ["Parle", "Britannia", "Weighted distribution"],
    "scope-creep": ["Scope creep", "requirements"],
    "surrogation": ["Zynga", "surrogation"],
}

# --- auto-merge the Jun 14 – Jul 2 extension cards, if present -------------
import importlib.util as _iu
from pathlib import Path as _Path
_ext_path = _Path(__file__).parent / "_cards_ext.py"
if _ext_path.exists():
    _spec = _iu.spec_from_file_location("cards_ext", _ext_path)
    _ext = _iu.module_from_spec(_spec); _spec.loader.exec_module(_ext)
    BOLD_V6 = {**BOLD_V6, **_ext.BOLD_EXT}

NEW_CARDS = [
    {
        "slug": "goodharts-law",
        "course": "young-professional-second-order-thinking",
        "image": "visual-0-cover.png",
        "headline": "Goodhart's Law",
        "explanation": (
            "Set a target, and people stop chasing the goal. They chase the target.\n\n"
            "Economist Charles Goodhart noticed it in 1975. The moment a measure becomes the thing you reward, "
            "people optimise the number instead of the outcome it was meant to track. The metric quietly stops "
            "telling the truth.\n\n"
            "Every metric you incentivise is a metric you can no longer fully trust."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#SystemsThinking #Incentives #BusinessStrategy",
    },
    {
        "slug": "crowding-out-effect",
        "course": "young-professional-second-order-thinking",
        "image": "visual-3.png",
        "headline": "Crowding Out Effect",
        "explanation": (
            "A daycare fined parents for picking their kids up late. Late pickups went up.\n\n"
            "An external incentive can destroy an internal one. The fine replaced guilt with a price, and parents "
            "decided the price was fair. Pay people to do what they once did out of pride, and the pride is what "
            "leaves.\n\n"
            "Remove the reward later, and the original motivation does not come back."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#BehavioralEconomics #Incentives #BusinessStrategy",
    },
    {
        "slug": "first-principles",
        "course": "young-professional-first-principles-reasoning",
        "image": "visual-0-cover.png",
        "headline": "First Principles",
        "explanation": (
            "Most decisions are copies of other decisions. First-principles thinking refuses the copy.\n\n"
            "Aristotle called it the first basis from which a thing is known. You strip a problem down to what is "
            "physically true, then build back up. What survives is a real constraint. Everything else was convention "
            "wearing the costume of a law.\n\n"
            "The hardest question in any industry: which rules are laws, and which are just habits?"
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#FirstPrinciples #ProblemSolving #BusinessStrategy",
    },
    {
        "slug": "idiot-index",
        "course": "young-professional-first-principles-reasoning",
        "image": "visual-4.png",
        "headline": "Idiot Index",
        "explanation": (
            "Take a finished product's price. Divide it by the cost of its raw materials. The bigger the number, "
            "the more you are paying for convention.\n\n"
            "The term comes from SpaceX engineering culture. A rocket's idiot index ran around fifty to one — fifty "
            "dollars of price for every dollar of metal. That gap is not physics. It is everything the industry "
            "stopped questioning.\n\n"
            "A high idiot index is not a cost. It is an opportunity nobody has priced yet."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#FirstPrinciples #Innovation #BusinessStrategy",
    },
    {
        "slug": "inversion",
        "course": "young-professional-inversion-thinking",
        "image": "visual-0-cover.png",
        "headline": "Inversion",
        "explanation": (
            "Most people ask how to succeed. The sharper question is how to guarantee failure, then refuse to do "
            "any of it.\n\n"
            "Charlie Munger built a career on it. Invert the problem, list every way it could die, and avoid each "
            "one. Tell me where I'll die, so I never go there.\n\n"
            "Avoiding stupidity is easier than seeking brilliance, and it wins more often."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#DecisionMaking #MentalModels #BusinessStrategy",
    },
    {
        "slug": "pre-mortem",
        "course": "young-professional-inversion-thinking",
        "image": "visual-3.png",
        "headline": "Pre-Mortem",
        "explanation": (
            "Before the project starts, imagine it has already failed. Spectacularly. Now explain why.\n\n"
            "Psychologist Gary Klein found this small reframe changes the room. Don't rock the boat becomes show "
            "how smart you are by spotting the crack. Treating the failure as certain surfaces far more reasons "
            "for it than politely asking what might go wrong.\n\n"
            "The risks you name before you start are the only ones you can still avoid."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#RiskManagement #DecisionMaking #BusinessStrategy",
    },
    {
        "slug": "keeper-test",
        "course": "hr-business-partner-attrition-diagnostics",
        "image": "visual-0-cover.png",
        "headline": "Keeper Test",
        "explanation": (
            "Netflix managers ask one question about every person on the team. If they were leaving for a similar "
            "job, would I fight to keep them?\n\n"
            "If the answer is no, that person gets a generous exit, not a development plan. Reed Hastings drew the "
            "lesson after the 2001 layoffs — performance rose when the weakest third left. Talent density became "
            "the strategy.\n\n"
            "A team is defined less by who it hires than by who it is willing to keep."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#Leadership #TalentManagement #BusinessStrategy",
    },
    {
        "slug": "vitality-curve",
        "course": "hr-business-partner-talent-calibration",
        "image": "visual-0-cover.png",
        "headline": "Vitality Curve",
        "explanation": (
            "Rank everyone. Reward the top fifth. Develop the middle. Fire the bottom tenth. Every single year.\n\n"
            "Jack Welch's 20-70-10 model ran GE and spread across the Fortune 500. It assumed talent always fits a "
            "bell curve. Then the evidence caught up: forced ranking drove out strong performers and rewarded "
            "political skill over results. Most companies have quietly abandoned it.\n\n"
            "When the curve is the target, you stop measuring people and start manufacturing a distribution."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#Leadership #PerformanceManagement #BusinessStrategy",
    },
    {
        "slug": "career-capital",
        "course": "young-professional-career-capital-design",
        "image": "visual-0-cover.png",
        "headline": "Career Capital",
        "explanation": (
            "Passion does not come first. Rare and valuable skills do, and the passion tends to follow them.\n\n"
            "Cal Newport called it career capital — the stock of hard-won skills that compounds. Each new "
            "capability makes the others worth more. Titles sit still. Capital builds on itself.\n\n"
            "Don't follow your passion. Build something so good it can't be ignored."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#CareerDevelopment #Skills #BusinessStrategy",
    },
    {
        "slug": "kasparovs-law",
        "course": "senior-leader-centaur-design",
        "image": "visual-0-cover.png",
        "headline": "Kasparov's Law",
        "explanation": (
            "In 2005, a pair of amateurs with three laptops won a freestyle chess tournament. They beat "
            "grandmasters. They beat supercomputers.\n\n"
            "Garry Kasparov drew the lesson. A weak human plus a machine plus a better process beats a strong human "
            "with a machine and a worse one. The edge was never raw power. It was the process between the human and "
            "the machine.\n\n"
            "Not the strongest player, not the fastest computer. The best collaboration."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#AI #FutureOfWork #BusinessStrategy",
    },
    {
        "slug": "jagged-frontier",
        "course": "senior-leader-centaur-design",
        "image": "visual-3.png",
        "headline": "Jagged Frontier",
        "explanation": (
            "AI is brilliant at some tasks that look hard, and hopeless at some that look easy. The line between "
            "them is not where you would expect.\n\n"
            "A Harvard and BCG study named it the jagged frontier. Difficulty for a human does not predict "
            "difficulty for a machine. The real danger is trusting it on the wrong side of a line you cannot see.\n\n"
            "The skill is no longer doing the work. It is knowing where the machine quietly fails."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#AI #FutureOfWork #BusinessStrategy",
    },
    {
        "slug": "automation-paradox",
        "course": "senior-leader-automation-paradox",
        "image": "visual-0-cover.png",
        "headline": "Automation Paradox",
        "explanation": (
            "The better the autopilot, the more it matters that the human can fly, and the less chance they ever "
            "get to practise.\n\n"
            "Lisanne Bainbridge described it in 1983. Automate the routine, and the operator's skills quietly fade "
            "— right up until the rare moment the machine hands control back. The reliability builds the trap. The "
            "one-percent failure springs it.\n\n"
            "The more a system runs itself, the more it depends on a skill it stops letting you keep."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#Automation #AI #BusinessStrategy",
    },
    {
        "slug": "center-of-gravity",
        "course": "operations-manager-hub-placement",
        "image": "visual-0-cover.png",
        "headline": "Center of Gravity",
        "explanation": (
            "Where do you put the warehouse? The math has an answer: the demand-weighted middle of every customer "
            "you serve.\n\n"
            "Each location pulls the optimal point toward itself with a force proportional to its volume. A market "
            "shipping ten thousand orders pulls ten times harder than one shipping a thousand. The formula is "
            "clean. The point it lands on is often a lake.\n\n"
            "The optimal location and the feasible one are rarely the same place."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#SupplyChain #Operations #BusinessStrategy",
    },
    {
        "slug": "dark-store",
        "course": "operations-manager-hub-placement",
        "image": "visual-3.png",
        "headline": "Dark Store",
        "explanation": (
            "There is a shop near you that you can never walk into. No aisles, no customers, no signage. Only "
            "orders.\n\n"
            "A dark store is a small fulfilment unit, a couple of thousand square feet, parked inside the "
            "neighbourhood it serves. Blinkit, Zepto and Swiggy Instamart run on them. The whole format exists to "
            "win minutes, not metres.\n\n"
            "Ten-minute delivery is not a logistics trick. It is a real-estate decision."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#QuickCommerce #SupplyChain #BusinessStrategy",
    },
    {
        "slug": "flight-to-quality",
        "course": "retail-investor-crisis-investing",
        "image": "visual-0-cover.png",
        "headline": "Flight to Quality",
        "explanation": (
            "When the world feels dangerous, money does not disappear. It moves.\n\n"
            "Capital floods out of risky assets and into safe ones — US Treasuries, gold, the largest stable "
            "names. For Indian investors there is a sting in the tail: foreign funds sell Indian equities and buy "
            "dollars, so the Nifty and the rupee tend to fall together.\n\n"
            "In a panic, safety is the one asset everybody tries to buy at once."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#Investing #Markets #BusinessStrategy",
    },
    {
        "slug": "sharpe-ratio",
        "course": "strategic-analyst-thesis-construction",
        "image": "visual-0-cover.png",
        "headline": "Sharpe Ratio",
        "explanation": (
            "Two funds both returned fifteen percent. One did it calmly, one on a rollercoaster. They are not the "
            "same fund.\n\n"
            "The Sharpe ratio measures return per unit of risk — how much volatility you swallowed for the gain. "
            "Higher looks better. But leverage and hidden tail risk can make a fragile strategy look smooth, right "
            "up until it isn't.\n\n"
            "A great return tells you what happened. The risk taken tells you whether to trust it."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#Investing #Finance #BusinessStrategy",
    },
    {
        "slug": "tragedy-of-the-commons",
        "course": "young-professional-system-archetype-diagnosis",
        "image": "visual-0-cover.png",
        "headline": "Tragedy of the Commons",
        "explanation": (
            "Every herder adds one more cow to the shared field. Each decision is rational. Together they destroy "
            "the field.\n\n"
            "It is a system archetype: when a shared resource is free at the point of use, individual sense becomes "
            "collective ruin. The fix is never a lecture. It is making the shared cost visible and immediate to "
            "each person who draws on it.\n\n"
            "When everyone owns it, no one protects it — unless the cost finds its way home."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#SystemsThinking #Strategy #BusinessStrategy",
    },
    {
        "slug": "shifting-the-burden",
        "course": "young-professional-system-archetype-diagnosis",
        "image": "visual-3.png",
        "headline": "Shifting the Burden",
        "explanation": (
            "The quick fix works. That is exactly what makes it dangerous.\n\n"
            "Lean on the symptomatic solution often enough and the capacity for the real one withers. A company "
            "that keeps firefighting forgets how to build what would stop the fires. The dependency hardens until "
            "the structural fix is no longer even an option.\n\n"
            "Every easy fix you reach for makes the hard fix a little harder to ever reach."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#SystemsThinking #Leadership #BusinessStrategy",
    },
    {
        "slug": "retrospective-taxation",
        "course": "tax-consultant-position-judgment",
        "image": "visual-0-cover.png",
        "headline": "Retrospective Taxation",
        "explanation": (
            "Picture a deal that was legal the day you signed it, taxed years later under a law written after the "
            "fact.\n\n"
            "India did exactly that in 2012, amending the law to reach back to 1962 and tax the Vodafone-Hutchison "
            "transaction. After losing in international arbitration, the government repealed the provision in 2021. "
            "Certainty, it turned out, was worth more than the tax.\n\n"
            "A rule that rewrites the past collects its real price in lost trust."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#Tax #Policy #BusinessStrategy",
    },
    {
        "slug": "weighted-distribution",
        "course": "territory-sales-manager-beat-planning",
        "image": "visual-0-cover.png",
        "headline": "Weighted Distribution",
        "explanation": (
            "Parle is in more shops than Britannia. Britannia still wins the shelf that matters.\n\n"
            "Numeric distribution counts how many stores stock you — pure breadth. Weighted distribution counts how "
            "much of the market's value those stores represent — depth. Being everywhere and being where the money "
            "is are two different victories.\n\n"
            "Availability is not the goal. Being available where the buying actually happens is."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#Sales #FMCG #BusinessStrategy",
    },
    {
        "slug": "scope-creep",
        "course": "technology-consultant-discovery-requirements",
        "image": "visual-0-cover.png",
        "headline": "Scope Creep",
        "explanation": (
            "Every project quietly grows. One small request, then another, until the thing you agreed to build is "
            "gone.\n\n"
            "It is tempting to blame the client. The real cause sits upstream: requirements too vague to draw a "
            "clear line. Scope creep is not cured by saying no. It is prevented by being specific enough that both "
            "sides can see exactly where the edge sits.\n\n"
            "You cannot defend a boundary you never drew."
        ),
        "close": "Read more on Rehearsal.",
        "hashtags": "#ProjectManagement #Consulting #BusinessStrategy",
    },
    {
        "slug": "surrogation",
        "course": "associate-product-manager-outcome-mapping",
        "image": "visual-0-cover.png",
        "headline": "Surrogation",
        "explanation": (
            "Give a team a metric for a goal, and soon they forget the goal and serve the metric.\n\n"
            "Psychologists call it surrogation. Zynga is the cautionary tale: it optimised daily users, revenue per "
            "user and virality while the actual experience left players feeling worse. The dashboard glowed green "
            "as the product rotted.\n\n"
            "When the measure becomes the mission, you can hit every number and still lose."
        ),
        "close": "Find more like this on Rehearsal.",
        "hashtags": "#ProductManagement #Metrics #BusinessStrategy",
    },
]

# extend NEW_CARDS with the merged extension (cards_ext loaded above)
if '_ext' in dir():
    NEW_CARDS = NEW_CARDS + _ext.CARDS_EXT
