/**
 * Phase 4 smoke — render an MBA-jargon card for EACH of the 7 diagram types, no AI, no banner.
 *   node --import tsx packages/render/scripts/jargon-smoke.ts
 *   # outputs land under .artifacts/posts/jargon-<type>/0.png
 */
import { RenderEngine, type JargonData } from '../src/index.js';

const CARDS: JargonData[] = [
  {
    headline: 'The 4 Ps',
    definition: 'The four levers every marketer controls: Product, Price, Place, Promotion.',
    diagram: {
      type: 'grid',
      items: [
        { label: 'Product', sub: 'what you make' },
        { label: 'Price', sub: 'what you charge' },
        { label: 'Place', sub: 'where you sell' },
        { label: 'Promotion', sub: 'how you tell' },
      ],
    },
    note: 'Coined by <b>E. Jerome McCarthy</b> in 1960, popularised by <b>Philip Kotler</b>.',
  },
  {
    headline: 'STP',
    definition: 'Going to market in three moves: segment, target, position.',
    diagram: {
      type: 'steps',
      items: [
        { label: 'Segmentation', sub: 'split the market' },
        { label: 'Targeting', sub: 'pick who to serve' },
        { label: 'Positioning', sub: 'own a place in their head' },
      ],
    },
    note: 'The backbone of modern marketing strategy, popularised by <b>Philip Kotler</b>.',
  },
  {
    headline: 'AIDA',
    definition: 'How a stranger becomes a buyer: Attention, Interest, Desire, Action.',
    diagram: {
      type: 'funnel',
      items: [
        { label: 'Attention', sub: 'get noticed' },
        { label: 'Interest', sub: 'earn a look' },
        { label: 'Desire', sub: 'make them want it' },
        { label: 'Action', sub: 'close' },
      ],
    },
    note: "One of advertising's oldest models, traced to <b>Elias St. Elmo Lewis</b> around 1898.",
  },
  {
    headline: 'Brand Equity',
    definition: 'The extra value a name carries, beyond the product itself.',
    diagram: {
      type: 'pyramid',
      items: [
        { label: 'Identity', sub: 'who are you?' },
        { label: 'Meaning', sub: 'what are you?' },
        { label: 'Response', sub: 'what do I think?' },
        { label: 'Resonance', sub: 'you and me' },
      ],
    },
    note: "Systematised by <b>David Aaker</b> (1991); the loyalty pyramid is <b>Kevin Keller's</b> CBBE model.",
  },
  {
    headline: 'Product Life Cycle',
    definition: 'Every product moves through four stages, each needing a different playbook.',
    diagram: { type: 'curve', phases: ['Introduction', 'Growth', 'Maturity', 'Decline'] },
    note: 'Framed by <b>Theodore Levitt</b> in HBR, 1965.',
  },
  {
    headline: 'Penetration vs Skimming',
    definition: 'Two opposite ways to price something new.',
    diagram: {
      type: 'versus',
      a: { title: 'Penetration', line: 'Enter low. Win volume fast. Raise later.', color: '#00c483' },
      b: { title: 'Skimming', line: 'Enter high. Harvest early adopters. Lower over time.', color: '#ff4859' },
    },
    note: 'The classic new-product trade-off, framed by <b>Joel Dean</b> in HBR, 1950.',
  },
  {
    headline: 'The USP',
    definition: 'The one true thing only you can say, that the buyer actually cares about.',
    diagram: {
      type: 'focus',
      items: [
        { label: '"us too"' },
        { label: '"us too"' },
        { label: '"us too"' },
        { label: 'only we can say this', highlight: true },
      ],
    },
    note: 'Coined by adman <b>Rosser Reeves</b> in 1961. If a rival can say it too, it is not unique.',
  },
];

async function main(): Promise<void> {
  const engine = new RenderEngine();
  try {
    for (const card of CARDS) {
      const ref = await engine.renderCard({
        postId: `jargon-${card.diagram.type}`,
        template: 'jargon',
        aspectRatio: '4:5',
        data: card,
      });
      console.log(`${card.diagram.type.padEnd(8)} → ${ref.storageKey}  (${card.headline})`);
    }
    console.log('OK — 7 diagram types rendered under .artifacts/posts/jargon-*');
  } finally {
    await engine.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
