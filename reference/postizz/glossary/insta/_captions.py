"""Instagram captions for the v6 "Business Glossary" square cards.

Voice: Rehearsal calm-authoritative documentary observer (social-media-pillars-
2026-05). Third person, evidence-first, counterintuitive lead, no first-person
singular, no exclamation, no emoji, no "Did you know". Glossary cards map to the
Concept Briefs / Articulation Gap angle: you may know the term — the test is
defending it under pressure. CTA rotates from the approved bank; IG uses
"Link in bio" (no inline links). 5-8 mixed hashtags (high-volume + niche +
branded), banned tags (#motivation #success #goals) excluded.

Writes {slug}.md (one per square card) into this folder.
"""
import importlib.util
from pathlib import Path

HERE = Path(__file__).parent
_c = importlib.util.spec_from_file_location("cards_v6", HERE.parent / "_cards_v6.py")
cards_v6 = importlib.util.module_from_spec(_c); _c.loader.exec_module(cards_v6)
HEAD = {c["slug"]: c["headline"] for c in cards_v6.NEW_CARDS}

# slug -> (hook, body, cta, hashtags)
CAPTIONS = {
"goodharts-law": (
"Set a target, and people stop chasing the goal. They start gaming the number.",
"Charles Goodhart noticed it in 1975: the moment a measure becomes a target, it stops measuring anything real. Every KPI you reward is one someone learns to hit without earning. Knowing the law is easy. Catching it inside your own dashboard, in a live meeting, is the harder skill.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #SystemsThinking #MBA #InterviewPrep #Incentives #BusinessStrategy"),

"crowding-out-effect": (
"A daycare fined parents for picking their kids up late. The late pickups went up.",
"An external incentive can quietly kill an internal one. The fine replaced guilt with a price, and parents decided the price was fair. The crowding-out effect is why money sometimes buys worse behaviour than obligation managed for free, and why removing the reward never brings the old motivation back.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #BehavioralEconomics #MBA #InterviewPrep #Incentives #BusinessStrategy"),

"first-principles": (
"Most decisions are copies of older decisions. First-principles reasoning refuses the copy.",
"Aristotle called it the first basis from which a thing is known: strip a problem to what is physically true, then rebuild upward. What survives is a real constraint. Everything else was convention dressed up as a law. The skill is telling the two apart out loud, the moment someone pushes back.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #FirstPrinciples #MBA #ConsultingPrep #ProblemSolving #BusinessStrategy"),

"idiot-index": (
"Take a product's price. Divide by the cost of its raw materials. The bigger the number, the more you are paying for convention.",
"The idiot index comes from SpaceX engineering culture, where a rocket's ran around fifty to one. That gap is rarely physics. It is everything an industry stopped questioning. Spotted early, a high index is not a cost. It is an opening nobody has priced yet.",
"Defensible in 15 minutes.",
"#Rehearsal #ConceptBriefs #FirstPrinciples #Innovation #MBA #Strategy #BusinessStrategy"),

"inversion": (
"Most people ask how to succeed. The sharper move is to ask how to guarantee failure, then avoid every step that leads there.",
"Charlie Munger built a career on inversion. List every way the plan could die, and steer around each one. Avoiding stupidity is easier than chasing brilliance, and it wins more often. Knowing the mental model is common. Reaching for it under pressure is not.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #MentalModels #DecisionMaking #MBA #InterviewPrep #BusinessStrategy"),

"pre-mortem": (
"Before the project starts, assume it has already failed. Then explain why.",
"Psychologist Gary Klein found the reframe changes the room: do not rock the boat becomes show how smart you are by spotting the crack. Treating failure as certain surfaces far more risks than politely asking what might go wrong. The risks you name before you start are the only ones you can still avoid.",
"Read it once. Practice it weekly.",
"#Rehearsal #ConceptBriefs #RiskManagement #DecisionMaking #MBA #Leadership #BusinessStrategy"),

"keeper-test": (
"Netflix managers ask one question about every report: if this person quit for a similar role, would I fight to keep them?",
"If the answer is no, the employee gets a generous exit, not a development plan. Reed Hastings drew the rule after the 2001 layoffs, when performance rose as the weakest third left. A team is defined less by who it hires than by who it is willing to keep.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #Leadership #TalentManagement #MBA #HR #BusinessStrategy"),

"vitality-curve": (
"Rank everyone. Reward the top fifth. Develop the middle. Fire the bottom tenth. Every year.",
"Jack Welch's 20-70-10 model ran GE and spread across the Fortune 500 on one assumption: talent always fits a bell curve. The evidence disagreed. Forced ranking drove out strong performers and rewarded politics, and most companies have quietly retired it. When the curve becomes the target, you stop measuring people and start manufacturing a distribution.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #Leadership #PerformanceManagement #MBA #HR #BusinessStrategy"),

"career-capital": (
"Passion rarely comes first. Rare, valuable skills do, and the passion follows them.",
"Cal Newport called it career capital: a stock of hard-won skills that compounds, each new capability making the others worth more. Titles sit still. Capital builds on itself. The advice that survives contact with reality is not follow your passion, but build something so good it cannot be ignored.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #CareerDevelopment #MBA #InterviewPrep #Skills #BusinessStrategy"),

"kasparovs-law": (
"In 2005, two amateurs with three laptops won a freestyle chess tournament. They beat grandmasters and supercomputers both.",
"Garry Kasparov drew the lesson: a weak human plus a machine plus a better process beats a strong human with a machine and a worse one. The edge was never raw power. It was the process between the human and the machine, which is exactly the part most teams never practise.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #AI #FutureOfWork #MBA #Leadership #BusinessStrategy"),

"jagged-frontier": (
"AI is brilliant at some tasks that look hard, and useless at some that look easy. The line between them is not where you would guess.",
"A Harvard and BCG study named it the jagged frontier: difficulty for a human does not predict difficulty for a machine. The danger is trusting it on the wrong side of a line you cannot see. The skill is no longer doing the work. It is knowing where the machine quietly fails.",
"Defensible in 15 minutes.",
"#Rehearsal #ConceptBriefs #AI #FutureOfWork #MBA #Strategy #BusinessStrategy"),

"automation-paradox": (
"The better the autopilot, the more it matters that the human can fly, and the less chance they ever get to practise.",
"Lisanne Bainbridge described the automation paradox in 1983. Automate the routine, and the operator's skill quietly fades, right until the rare moment the machine hands control back. Reliability builds the trap. The one-percent failure springs it.",
"Read it once. Practice it weekly.",
"#Rehearsal #ConceptBriefs #Automation #AI #FutureOfWork #MBA #BusinessStrategy"),

"center-of-gravity": (
"Where do you put the warehouse? The math says the demand-weighted middle of every customer you serve.",
"Each location pulls the optimal point toward it with a force set by its volume: ten thousand orders pull ten times harder than one thousand. The formula is clean. The point it lands on is often a lake. The optimal location and the feasible one are rarely the same place.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #SupplyChain #Operations #MBA #Strategy #BusinessStrategy"),

"dark-store": (
"There is a shop near you that you can never walk into. No aisles, no customers, no signage. Only orders.",
"A dark store is a small fulfilment unit parked inside the neighbourhood it serves: a couple of thousand square feet, a limited range. Blinkit, Zepto and Swiggy Instamart run on them. Ten-minute delivery is not a logistics trick. It is a real-estate decision.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #QuickCommerce #SupplyChain #MBA #Startups #BusinessStrategy"),

"flight-to-quality": (
"When the world feels dangerous, money does not disappear. It moves.",
"Capital floods out of risky assets and into safe ones: US Treasuries, gold, the largest stable names. For Indian investors there is a sting in the tail, as foreign funds sell local equities and buy dollars, so the Nifty and the rupee fall together. In a panic, safety is the one asset everyone tries to buy at once.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #Investing #Markets #Finance #MBA #BusinessStrategy"),

"sharpe-ratio": (
"Two funds both returned fifteen percent. One did it calmly, one on a rollercoaster. They are not the same fund.",
"The Sharpe ratio measures return per unit of risk: how much volatility you swallowed for the gain. Higher looks better, but leverage and hidden tail risk can make a fragile strategy look smooth, right until it is not. A return tells you what happened. The risk taken tells you whether to trust it.",
"Defensible in 15 minutes.",
"#Rehearsal #ConceptBriefs #Investing #Finance #MBA #ConsultingPrep #BusinessStrategy"),

"tragedy-of-the-commons": (
"Every herder adds one more cow to the shared field. Each choice is rational. Together they destroy the field.",
"It is a system archetype: when a shared resource is free at the point of use, individual sense becomes collective ruin. The fix is never a lecture. It is making the shared cost visible and immediate to each person who draws on it. When everyone owns it, no one protects it.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #SystemsThinking #Economics #MBA #Strategy #BusinessStrategy"),

"shifting-the-burden": (
"The quick fix works. That is exactly what makes it dangerous.",
"Lean on the symptomatic solution often enough and the capacity for the real one withers. A company that keeps firefighting forgets how to build what would stop the fires, until the structural fix is no longer even an option. Every easy fix makes the hard one harder to reach.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #SystemsThinking #Leadership #MBA #Strategy #BusinessStrategy"),

"retrospective-taxation": (
"Picture a deal that was legal the day you signed it, taxed years later under a law written after the fact.",
"India did exactly that in 2012, amending the law to reach back to 1962 and tax the Vodafone-Hutchison transaction. After losing in international arbitration, the government repealed it in 2021. A rule that rewrites the past collects its real price in lost trust.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #Tax #Policy #MBA #Finance #BusinessStrategy"),

"weighted-distribution": (
"Parle is in more shops than Britannia. Britannia still wins the shelf that matters.",
"Numeric distribution counts how many stores stock you, pure breadth. Weighted distribution counts how much of the market's value those stores represent, depth. Being everywhere and being where the money is are two different victories. Availability is not the goal. Being available where the buying happens is.",
"Practice this in Rehearsal.",
"#Rehearsal #ConceptBriefs #Sales #FMCG #MBA #Marketing #BusinessStrategy"),

"scope-creep": (
"Every project quietly grows. One small request, then another, until the thing you agreed to build is gone.",
"It is tempting to blame the client. The real cause sits upstream, in requirements too vague to draw a clear line. Scope creep is not cured by saying no. It is prevented by being specific enough that both sides can see exactly where the edge sits. You cannot defend a boundary you never drew.",
"Read it once. Practice it weekly.",
"#Rehearsal #ConceptBriefs #ProjectManagement #Consulting #MBA #ProductManagement #BusinessStrategy"),

"surrogation": (
"Give a team a metric for a goal, and soon they forget the goal and serve the metric.",
"Psychologists call it surrogation. Zynga is the cautionary case: it optimised daily users, revenue per user and virality while the actual experience left players feeling worse. The dashboard glowed green as the product rotted. When the measure becomes the mission, you can hit every number and still lose.",
"Read it. Now defend it.",
"#Rehearsal #ConceptBriefs #ProductManagement #Metrics #MBA #Strategy #BusinessStrategy"),
}

MD = """# {headline} — Instagram caption

**Platform:** Instagram feed, square 1080x1080 (`{slug}-sq.png`)
**Series:** The Business Glossary (v6)
**Voice:** Rehearsal calm-authoritative documentary observer (social-media-pillars-2026-05)
**Pillar angle:** Concept Briefs / Articulation Gap (know it vs defend it)

## Caption

{hook}

{body}

{cta}

Link in bio.

{hashtags}
"""


def main():
    missing = [s for s in HEAD if s not in CAPTIONS]
    if missing:
        print("  ! no caption for:", missing)
    for slug, (hook, body, cta, tags) in CAPTIONS.items():
        (HERE / f"{slug}.md").write_text(MD.format(
            headline=HEAD.get(slug, slug), slug=slug,
            hook=hook, body=body, cta=cta, hashtags=tags,
        ))
    print(f"  wrote {len(CAPTIONS)} caption .md files into {HERE.name}/")


if __name__ == "__main__":
    main()
