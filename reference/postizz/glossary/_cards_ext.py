"""Extension cards (Jun 14 – Jul 2 roster). 38 NEW glossary terms, all from
ACTIVE production courses, each grounded in the course's audited glossary.meaning
+ canonical public fact. No term or image reused from the live v6/v5 campaign.

Merged into _cards_v6.NEW_CARDS / BOLD_V6 automatically (see tail of _cards_v6.py).
Schema matches NEW_CARDS: slug, course (local visuals folder), image, headline,
explanation (\\n\\n paragraphs), close (rotating CTA), hashtags (LinkedIn).
"""

BOLD_EXT = {
    "the-offer": ["Zappos"],
    "aladdin": ["Aladdin", "BlackRock"],
    "cow-path": ["Michael Hammer"],
    "war-premium": ["Russia-Ukraine"],
    "forward-deployed-engineer": ["Palantir"],
    "vertical-integration": ["SpaceX"],
    "premeditatio-malorum": ["Marcus Aurelius", "Seneca"],
    "forced-distribution": ["Forced distribution", "bell curve"],
    "mesh-network": ["Delhivery"],
    "effective-tax-rate": ["Apple"],
    "india-vix": ["India VIX", "NSE"],
    "skill-atrophy": ["skill atrophy"],
    "escalation": ["escalation"],
    "alpha": ["alpha", "beta"],
    "mis-selling": ["IRDAI"],
    "task-unbundling": ["Self-checkout"],
    "numeric-distribution": ["Parle", "Britannia"],
    "self-binding-governance": ["Ulysses"],
    "cannibalization": ["Cannibalization"],
    "convention-blindness": ["convention blindness"],
    "ambidextrous-organization": ["O'Reilly and Tushman"],
    "defense-sector-rotation": ["Operation Sindoor", "Nifty Defence"],
    "deskilling": ["deskilled"],
    "the-ask": ["DocSend"],
    "compa-ratio": ["Compa-ratio"],
    "tax-ruling": ["LuxLeaks", "PwC Luxembourg"],
    "leverage-point": ["Donella Meadows"],
    "identity-lock-in": ["Identity lock-in"],
    "hub-and-spoke": ["Blue Dart"],
    "affinity-bias": ["Affinity bias"],
    "inverted-apprenticeship": ["Beane and Anthony"],
    "tracking-error": ["Tracking error"],
    "business-process-reengineering": ["Michael Hammer"],
    "safe-haven-assets": ["Gold", "US Treasuries"],
    "perceptual-map": ["Dove"],
    "value-proposition": ["value proposition"],
    "nav-reconciliation": ["NAV reconciliation"],
    "one-month-manual-rule": ["one-month manual rule"],
}

CARDS_EXT = [
    {"slug":"the-offer","course":"hr-business-partner-attrition-diagnostics","image":"visual-1.png","headline":"The Offer",
     "explanation":("Zappos pays new hires to quit. After four weeks of training, every recruit is offered a few thousand dollars to walk away.\n\n"
        "Almost nobody takes it, only two or three in a hundred. The ones who stay have chosen the culture over easy cash, and they engage harder for having chosen. The offer turns a passive hire into a committed one.\n\n"
        "The cheapest way to keep people is to give them a clean chance to leave."),
     "close":"Read it. Now defend it.","hashtags":"#HR #Leadership #BusinessStrategy"},
    {"slug":"aladdin","course":"strategic-analyst-thesis-construction","image":"visual-1.png","headline":"Aladdin",
     "explanation":("One piece of software watches over more money than most economies produce. It is called Aladdin.\n\n"
        "Built by BlackRock, it monitors trillions in assets for hundreds of institutions, running thousands of risk factors and endless simulations on one operating system. It recently reached India through the Jio BlackRock venture.\n\n"
        "When a single risk engine sees that much of the market, the question stops being who owns the assets and becomes who sees them first."),
     "close":"Defensible in 15 minutes.","hashtags":"#Finance #Investing #BusinessStrategy"},
    {"slug":"cow-path","course":"senior-leader-integration-strategy","image":"visual-0-cover.png","headline":"Cow Path",
     "explanation":("Cows wander a hillside and wear a crooked path. Centuries later we pave it, and the crookedness becomes permanent.\n\n"
        "Michael Hammer used the image for software. Automate a broken process and you do not fix it, you make it faster and harder to ever change. The detour is now set in concrete.\n\n"
        "Before automating the work, ask why the work is shaped that way at all."),
     "close":"Read it. Now defend it.","hashtags":"#Strategy #Operations #BusinessStrategy"},
    {"slug":"war-premium","course":"retail-investor-crisis-investing","image":"visual-1.png","headline":"War Premium",
     "explanation":("When conflict threatens supply, the price of oil carries a fee that has nothing to do with how much is pumped. It is the market pricing in fear.\n\n"
        "After the Russia-Ukraine shock, analysts put that war premium near ten to fifteen dollars a barrel. For India, every ten-dollar rise in crude can add roughly half a percent to inflation.\n\n"
        "The barrel did not change. The story wrapped around it moved the price."),
     "close":"Read it. Now defend it.","hashtags":"#Investing #Markets #BusinessStrategy"},
    {"slug":"forward-deployed-engineer","course":"enterprise-growth-lead-techno-commercial-selling","image":"visual-1.png","headline":"Forward Deployed Engineer",
     "explanation":("Most software is sold, installed, and left alone. Palantir sends an engineer to live inside the customer instead.\n\n"
        "A forward deployed engineer sits at the client's site and builds bespoke solutions to their exact problems, until the platform becomes part of how the institution runs. That is not implementation. It is entanglement.\n\n"
        "The deepest moat is not a better feature. It is being woven into someone's daily operations."),
     "close":"Defensible in 15 minutes.","hashtags":"#B2BSales #Strategy #BusinessStrategy"},
    {"slug":"vertical-integration","course":"young-professional-first-principles-reasoning","image":"visual-1.png","headline":"Vertical Integration",
     "explanation":("Most companies buy their parts. SpaceX builds about eighty-five percent of a rocket itself.\n\n"
        "Vertical integration means making in-house what others outsource. It becomes a weapon when the supply chain's prices are set by convention rather than physics, when the markup is tradition, not cost.\n\n"
        "Sometimes the cheapest supplier is the one you build yourself."),
     "close":"Read it. Now defend it.","hashtags":"#FirstPrinciples #Strategy #BusinessStrategy"},
    {"slug":"premeditatio-malorum","course":"young-professional-inversion-thinking","image":"visual-1.png","headline":"Premeditatio Malorum",
     "explanation":("The Stoics had a nightly habit: picture the worst before it arrives. They called it premeditatio malorum, the premeditation of evils.\n\n"
        "Marcus Aurelius and Seneca rehearsed loss, failure and insult on purpose, not from gloom but from preparation. A blow imagined in advance lands softer when it finally comes.\n\n"
        "Fear shrinks the moment you make yourself look straight at it."),
     "close":"Read it once. Practice it weekly.","hashtags":"#MentalModels #DecisionMaking #BusinessStrategy"},
    {"slug":"forced-distribution","course":"hr-business-partner-talent-calibration","image":"visual-1.png","headline":"Forced Distribution",
     "explanation":("Tell managers that exactly ten percent of any team must be rated poor, and you will always find your ten percent, even on a team of stars.\n\n"
        "Forced distribution bends every group onto a bell curve whether the people fit it or not. It manufactures a scarcity of top ratings and guarantees that some strong performers get labelled weak.\n\n"
        "A quota does not measure talent. It just decides in advance how many will be told they failed."),
     "close":"Read it. Now defend it.","hashtags":"#HR #PerformanceManagement #BusinessStrategy"},
    {"slug":"mesh-network","course":"operations-manager-hub-placement","image":"visual-1.png","headline":"Mesh Network",
     "explanation":("Old logistics funnels everything through a few giant hubs. A mesh lets every facility route to every other one.\n\n"
        "Delhivery runs this way: when a bottleneck appears, parcels reroute in real time instead of waiting on one central sort. No single hub is a single point of failure.\n\n"
        "The strongest networks have no center to break."),
     "close":"Practice this in Rehearsal.","hashtags":"#SupplyChain #Operations #BusinessStrategy"},
    {"slug":"effective-tax-rate","course":"tax-consultant-position-judgment","image":"visual-1.png","headline":"Effective Tax Rate",
     "explanation":("The headline tax rate is what the law asks. The effective rate is what a company actually pays after every deduction, credit and clever structure.\n\n"
        "The gap can be vast. Apple's Irish operations once paid an effective rate of around 0.005 percent against a statutory 12.5.\n\n"
        "The rate on paper is a starting bid. The effective rate is the real story."),
     "close":"Read it. Now defend it.","hashtags":"#Tax #Finance #BusinessStrategy"},
    {"slug":"india-vix","course":"retail-investor-crisis-investing","image":"visual-2.png","headline":"India VIX",
     "explanation":("There is a number that measures fear. When investors are scared, they pay up for protection, and the gauge climbs.\n\n"
        "India VIX, built by the NSE from Nifty options, sits at twelve to twenty in calm times and spikes past fifty in a crisis, touching roughly eighty during the 2020 crash. Counterintuitively, very high readings have tended to precede recoveries, not deeper falls.\n\n"
        "Peak fear and peak danger are rarely the same moment."),
     "close":"Read it. Now defend it.","hashtags":"#Investing #Markets #BusinessStrategy"},
    {"slug":"skill-atrophy","course":"senior-leader-centaur-design","image":"visual-1.png","headline":"Skill Atrophy",
     "explanation":("When the machine does the hard part, the human slowly forgets how. That erosion has a name: skill atrophy.\n\n"
        "Systems that boost output while quietly hollowing out ability are a time bomb. The numbers look great right up until a human has to step in and cannot.\n\n"
        "Productivity you cannot sustain without the tool is borrowed, not earned."),
     "close":"Read it once. Practice it weekly.","hashtags":"#AI #FutureOfWork #BusinessStrategy"},
    {"slug":"escalation","course":"young-professional-system-archetype-diagnosis","image":"visual-1.png","headline":"Escalation",
     "explanation":("Two rivals each take a step they call defensive. The other reads it as a threat and steps back harder. Round and round, past anything either side intended.\n\n"
        "Systems thinkers call it escalation, an arms race, a price war, a comment thread. Each move is rational; the spiral is not. Usually only an outside limit or one side walking away ends it.\n\n"
        "The way to win an escalation is to notice you are in one."),
     "close":"Read it. Now defend it.","hashtags":"#SystemsThinking #Strategy #BusinessStrategy"},
    {"slug":"alpha","course":"strategic-analyst-thesis-construction","image":"visual-2.png","headline":"Alpha",
     "explanation":("Every investor wants alpha, the return earned above what the market handed out for free. It is the proof that skill, not luck, was at work.\n\n"
        "The catch: most apparent alpha is really beta in disguise, ordinary market exposure dressed up as brilliance. Telling the two apart is the whole job.\n\n"
        "Beating the market is easy to claim and brutally hard to prove."),
     "close":"Defensible in 15 minutes.","hashtags":"#Investing #Finance #BusinessStrategy"},
    {"slug":"mis-selling","course":"insurance-sales-officer-product-literacy","image":"visual-0-cover.png","headline":"Mis-Selling",
     "explanation":("A policy sold to hit a commission target instead of a customer's need has a name. Regulators call it mis-selling.\n\n"
        "It happens when the incentive points at the sale, not the buyer, the wrong cover, the wrong risk profile, the wrong person. In India the IRDAI tracks it through complaint ratios and has acted against insurers with systematic patterns.\n\n"
        "A sale that ignores the customer is a liability wearing the costume of revenue."),
     "close":"Practice this in Rehearsal.","hashtags":"#Insurance #Sales #BusinessStrategy"},
    {"slug":"task-unbundling","course":"senior-leader-task-anatomy","image":"visual-0-cover.png","headline":"Task Unbundling",
     "explanation":("Automation does not replace jobs. It replaces tasks, and a job is just a bundle of them.\n\n"
        "Self-checkout unbundled the cashier: it took the scanning and left the troubleshooting, the loss prevention, the human judgment. The job survived because only one task left.\n\n"
        "Ask not whether a role can be automated, but which of its tasks can."),
     "close":"Read it. Now defend it.","hashtags":"#FutureOfWork #Automation #BusinessStrategy"},
    {"slug":"numeric-distribution","course":"territory-sales-manager-beat-planning","image":"visual-1.png","headline":"Numeric Distribution",
     "explanation":("There are two ways to count how widely a product sells, and they tell different stories.\n\n"
        "Numeric distribution is pure reach: the share of all stores that stock you. Parle leads here, sitting in more shops than Britannia. It says nothing about whether those shops are the ones that matter.\n\n"
        "Being in the most stores and being in the right stores are not the same win."),
     "close":"Practice this in Rehearsal.","hashtags":"#Sales #FMCG #BusinessStrategy"},
    {"slug":"self-binding-governance","course":"founder-governance-design","image":"visual-0-cover.png","headline":"Self-Binding Governance",
     "explanation":("Ulysses had himself tied to the mast so he could hear the sirens and not steer toward them. Some founders do the same to themselves.\n\n"
        "Self-binding governance is building rules that limit your own future power, board seats you cannot pack, decisions you cannot reverse, so the company stays protected even when you are tempted.\n\n"
        "The strongest leaders design the cage before they need it."),
     "close":"Read it. Now defend it.","hashtags":"#Governance #Leadership #BusinessStrategy"},
    {"slug":"cannibalization","course":"brand-manager-downward-brand-extension","image":"visual-0-cover.png","headline":"Cannibalization",
     "explanation":("A company launches a cheaper product and sales rise. The trap is where the sales came from.\n\n"
        "Cannibalization is when the new product eats the old one instead of the competition, the customer who would have bought premium reaching for budget instead. Revenue can grow while the brand quietly erodes, for years, before anyone notices.\n\n"
        "Growth that feeds on your own margins is not growth. It is a countdown."),
     "close":"Practice this in Rehearsal.","hashtags":"#Marketing #BrandStrategy #BusinessStrategy"},
    {"slug":"convention-blindness","course":"young-professional-first-principles-reasoning","image":"visual-2.png","headline":"Convention Blindness",
     "explanation":("Say a price out loud often enough and it starts to feel like a law of nature. Batteries cost six hundred dollars a kilowatt-hour, everyone knew it.\n\n"
        "Except the raw materials cost about eighty. The rest was convention blindness: mistaking an industry's habit for physics. And it deepens with experience, the more years you spend inside a field, the more its rules feel like gravity.\n\n"
        "The most expensive assumptions are the ones nobody questions anymore."),
     "close":"Read it. Now defend it.","hashtags":"#FirstPrinciples #Innovation #BusinessStrategy"},
    {"slug":"ambidextrous-organization","course":"senior-leader-ambidextrous-design","image":"visual-0-cover.png","headline":"Ambidextrous Organization",
     "explanation":("Most companies are built to do one thing well. A rare few run two clocks at once.\n\n"
        "An ambidextrous organization exploits today's business for profit while a structurally separate unit explores tomorrow's, different metrics, different culture, joined only at the top. O'Reilly and Tushman found the pattern studying breakthrough efforts across nine industries.\n\n"
        "The hard trick is not choosing between today and tomorrow. It is running both."),
     "close":"Defensible in 15 minutes.","hashtags":"#Strategy #Leadership #BusinessStrategy"},
    {"slug":"defense-sector-rotation","course":"retail-investor-crisis-investing","image":"visual-3.png","headline":"Defense Sector Rotation",
     "explanation":("When tensions rise, money does not just flee. Some of it charges toward the guns.\n\n"
        "Defense sector rotation is capital moving into defence stocks on the bet that military spending climbs. During India's Operation Sindoor in 2025, the Nifty Defence index jumped about twenty-four percent in seven sessions. These rallies are fast and sentiment-driven, and often reverse once the diplomacy starts.\n\n"
        "The rally arrives with the headline and leaves with the ceasefire."),
     "close":"Read it. Now defend it.","hashtags":"#Investing #Markets #BusinessStrategy"},
    {"slug":"deskilling","course":"senior-leader-automation-paradox","image":"visual-1.png","headline":"Deskilling",
     "explanation":("Stop doing a thing and the ability to do it fades. Not forgotten exactly, deskilled.\n\n"
        "When automation takes over a practised task, motor timing slips, mental models drift, diagnosis slows. The operator looks fine until the moment the machine needs them, and then the rust shows.\n\n"
        "A skill you no longer use is a skill you are quietly losing."),
     "close":"Read it once. Practice it weekly.","hashtags":"#Automation #FutureOfWork #BusinessStrategy"},
    {"slug":"the-ask","course":"young-professional-persuasive-pitching","image":"visual-0-cover.png","headline":"The Ask",
     "explanation":("Every pitch lives or dies on one sentence: the ask. The exact, quantified thing you want.\n\n"
        "A strong ask says what you need, what you give back, and where the money goes. A weak one is vague or buried, and attention does not wait. DocSend found investors spend under four minutes on a deck on average.\n\n"
        "If they remember one line, make sure it is the one where you asked."),
     "close":"Defensible in 15 minutes.","hashtags":"#Startups #Pitching #BusinessStrategy"},
    {"slug":"compa-ratio","course":"young-professional-compensation-architecture","image":"visual-1.png","headline":"Compa-Ratio",
     "explanation":("There is a number that decides your next raise, and most people never learn it exists.\n\n"
        "Compa-ratio is your salary divided by the midpoint of your pay band. At 0.80 you sit twenty percent below midpoint, with room to climb. At 1.20 you near the ceiling, and HR quietly starts tapering your raises.\n\n"
        "You cannot negotiate against a number you have never been shown."),
     "close":"Read it. Now defend it.","hashtags":"#Careers #Compensation #BusinessStrategy"},
    {"slug":"tax-ruling","course":"tax-consultant-position-judgment","image":"visual-2.png","headline":"Tax Ruling",
     "explanation":("A tax ruling is meant to give certainty: the authority tells you in advance how a deal will be treated.\n\n"
        "In the right hands it is prudent planning. In the wrong ones it is a rubber stamp, LuxLeaks exposed how PwC Luxembourg used advance rulings to pre-approve aggressive structures for some 340 multinationals.\n\n"
        "The same instrument can buy clarity or sell cover. The difference is intent."),
     "close":"Read it. Now defend it.","hashtags":"#Tax #Policy #BusinessStrategy"},
    {"slug":"leverage-point","course":"young-professional-leverage-point-identification","image":"visual-0-cover.png","headline":"Leverage Point",
     "explanation":("In every system there is a spot where a small push moves everything. Find it and you barely have to shove.\n\n"
        "Donella Meadows mapped twelve such leverage points, from tweaking numbers at the weak end to shifting the whole paradigm at the strong one. Most people push hardest on the levers that move least.\n\n"
        "The art is not effort. It is knowing where to apply it."),
     "close":"Read it. Now defend it.","hashtags":"#SystemsThinking #Strategy #BusinessStrategy"},
    {"slug":"identity-lock-in","course":"young-professional-career-capital-design","image":"visual-1.png","headline":"Identity Lock-in",
     "explanation":("The job title you wear starts to feel like who you are. Then any move that means starting over feels like losing yourself.\n\n"
        "Identity lock-in is that quiet trap. It pushes people to climb within one function, to optimise the title, instead of building rarer skills across several. The résumé looks consistent and the options keep shrinking.\n\n"
        "Define yourself by what you can do, not by what you are called."),
     "close":"Practice this in Rehearsal.","hashtags":"#Careers #Skills #BusinessStrategy"},
    {"slug":"hub-and-spoke","course":"operations-manager-hub-placement","image":"visual-2.png","headline":"Hub-and-Spoke",
     "explanation":("Send everything to one big sorting center, then fan it back out. That is hub-and-spoke, and it is wonderfully efficient until it isn't.\n\n"
        "Blue Dart's aviation network runs this way, central hubs connecting regions through one sort. Predictable, high-volume routes love it. Sudden shifts in demand expose it, because the hub is also the single point of failure.\n\n"
        "Efficiency and fragility often share the same address."),
     "close":"Read it. Now defend it.","hashtags":"#SupplyChain #Operations #BusinessStrategy"},
    {"slug":"affinity-bias","course":"young-professional-curveball-navigation","image":"visual-0-cover.png","headline":"Affinity Bias",
     "explanation":("An interviewer meets a candidate who reminds them of themselves and feels a quiet click. They call it fit.\n\n"
        "Affinity bias is that pull toward people who share your background, school or demographics, and it hides well. Similarity gets rationalised as culture fit, difference as values misalignment. The bias dresses itself up as judgment.\n\n"
        "When a hire just feels right, that is exactly the moment to check why."),
     "close":"Read it. Now defend it.","hashtags":"#Hiring #HR #BusinessStrategy"},
    {"slug":"inverted-apprenticeship","course":"senior-leader-centaur-design","image":"visual-2.png","headline":"Inverted Apprenticeship",
     "explanation":("For centuries the senior taught the junior. New technology can flip the arrow.\n\n"
        "Inverted apprenticeship is the junior teaching the expert, usually about a tool the veteran never grew up with. Beane and Anthony found four ways it happens, but fewer than one in ten produce real benefit for both sides on their own.\n\n"
        "The org chart says who reports to whom. It does not say who learns from whom."),
     "close":"Defensible in 15 minutes.","hashtags":"#FutureOfWork #Leadership #BusinessStrategy"},
    {"slug":"tracking-error","course":"strategic-analyst-thesis-construction","image":"visual-3.png","headline":"Tracking Error",
     "explanation":("A fund that perfectly copies its index has a tracking error of zero, and adds nothing you could not buy for free.\n\n"
        "Tracking error measures how far a portfolio strays from its benchmark. Passive funds keep it under two or three percent; active funds run higher because they are placing bets. Too low and you are a closet index; too high and you are off your mandate.\n\n"
        "The number quietly reveals how much independent thinking is actually happening."),
     "close":"Defensible in 15 minutes.","hashtags":"#Investing #Finance #BusinessStrategy"},
    {"slug":"business-process-reengineering","course":"senior-leader-integration-strategy","image":"visual-1.png","headline":"Business Process Reengineering",
     "explanation":("Most improvement asks how to do the same work faster. Reengineering asks a ruder question: why do this work at all?\n\n"
        "Michael Hammer coined business process reengineering in 1990, not tuning a process but tearing it up and redesigning around the outcome. Done well it collapses cost and time at once. Done as a slogan it just means layoffs.\n\n"
        "The biggest gains hide in the steps you stop doing entirely."),
     "close":"Read it. Now defend it.","hashtags":"#Strategy #Operations #BusinessStrategy"},
    {"slug":"safe-haven-assets","course":"retail-investor-crisis-investing","image":"visual-4.png","headline":"Safe Haven Assets",
     "explanation":("When markets fall, a handful of assets rise, or at least refuse to sink. Gold, US Treasuries, the dollar, the yen.\n\n"
        "These are safe havens, where frightened capital runs to hide. For Indian investors gold is the most reachable one: it rose around twenty-five percent in 2008 while equities halved. But its crisis spike is usually temporary, gold works best as a steady stabiliser, not a panic trade.\n\n"
        "The time to own the umbrella is before it rains."),
     "close":"Read it. Now defend it.","hashtags":"#Investing #Markets #BusinessStrategy"},
    {"slug":"perceptual-map","course":"brand-manager-market-positioning","image":"visual-1.png","headline":"Perceptual Map",
     "explanation":("Plot every brand in a category on two axes of how customers see them, and a picture appears: clusters where everyone crowds, and empty space where no one stands.\n\n"
        "That empty space is the prize. A perceptual map is how you find it, Dove spotted an unclaimed quadrant once worth around four billion dollars.\n\n"
        "The best position on the map is often the one nobody else wanted."),
     "close":"Practice this in Rehearsal.","hashtags":"#Marketing #BrandStrategy #BusinessStrategy"},
    {"slug":"value-proposition","course":"young-professional-persuasive-pitching","image":"visual-1.png","headline":"Value Proposition",
     "explanation":("A value proposition is not a slogan. It is a claim you could be proven wrong about.\n\n"
        "Strong ones are testable, we deliver in ten minutes can be checked against the clock. Weak ones hide behind best-in-class service, which means nothing and risks nothing. It answers the only question the listener is really asking: why should I care?\n\n"
        "If your promise cannot be falsified, it cannot be believed either."),
     "close":"Defensible in 15 minutes.","hashtags":"#Startups #Marketing #BusinessStrategy"},
    {"slug":"nav-reconciliation","course":"senior-analyst-custodian-reconciliation","image":"visual-0-cover.png","headline":"NAV Reconciliation",
     "explanation":("A fund's net asset value is the number everyone trusts. Reconciliation is what earns that trust.\n\n"
        "NAV reconciliation checks the fund's own valuation against the custodian's, line by line. If positions, cash and profit all agree, the NAV agrees too, it is the last gate before the number goes out the door.\n\n"
        "The figure investors rely on is only as honest as the check behind it."),
     "close":"Practice this in Rehearsal.","hashtags":"#Finance #Investing #BusinessStrategy"},
    {"slug":"one-month-manual-rule","course":"senior-leader-task-anatomy","image":"visual-1.png","headline":"One-Month Manual Rule",
     "explanation":("Want to know if a task can be automated? Ask how long it would take to teach from a manual.\n\n"
        "The one-month manual rule says: if a person could learn the task from written instructions within a month, it runs on explicit knowledge, and that makes it an automation candidate. Applied to single tasks, it sidesteps the politics of judging whole jobs.\n\n"
        "What can be written down can usually be handed off."),
     "close":"Read it once. Practice it weekly.","hashtags":"#FutureOfWork #Automation #BusinessStrategy"},
]
