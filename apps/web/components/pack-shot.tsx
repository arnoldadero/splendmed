import type { Product } from '@splendmed/domain';

import { productVisual, tintFor } from '@/lib/product-visual';

/**
 * A rendered pack shot: the product's own name and strength printed on a carton,
 * bottle, tube, sachet or tin.
 *
 * Why this rather than photographs. The legitimate sources of real product
 * photography are SplendMed's own camera, the manufacturers' trade asset
 * libraries, or Juleb — none of them available today. Copying a competitor's
 * catalogue images is not one of the options. And inventing packaging that
 * imitates a real brand's design would be worse than either: for a medicine, a
 * convincing picture of the wrong box misleads.
 *
 * So the pack is deliberately generic in design and specific in content. The
 * shopper sees the name and strength they are buying on a container of the right
 * kind, colour-coded by shelf, and nothing pretends to be the manufacturer's
 * artwork. Real photography still takes over automatically when it arrives —
 * see ProductImage.
 *
 * Decorative to assistive technology: the product name is the card's own heading
 * right beside it, so announcing the drawing would only repeat it.
 */

type Shape = 'carton' | 'bottle' | 'tube' | 'sachet' | 'tin';

function shapeFor(product: Pick<Product, 'form' | 'unitLabel'>): Shape {
  switch (productVisual(product)) {
    case 'bottle':
      return 'bottle';
    case 'tube':
      return 'tube';
    case 'sachet':
      return 'sachet';
    case 'tin':
      return 'tin';
    // Tablets, capsules, devices and inhalers are all sold boxed.
    default:
      return 'carton';
  }
}

/** Greedy word wrap into at most `maxLines`, ellipsising whatever overflows. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, maxChars - 1)}…`;
    return kept;
  }
  return lines;
}

/** Scales type down for long names so every pack stays legible. */
function nameSize(lines: readonly string[]): number {
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest <= 7) return 19;
  if (longest <= 9) return 16;
  if (longest <= 11) return 14;
  return 12;
}

interface Label {
  readonly brand: string | null;
  readonly lines: readonly string[];
  readonly size: number;
  readonly strength: string | null;
}

function NameBlock({ label, cx, top, ink }: { label: Label; cx: number; top: number; ink: string }) {
  const lineHeight = label.size * 1.12;
  return (
    <>
      {label.lines.map((line, i) => (
        <text
          key={`${i}-${line}`}
          x={cx}
          y={top + i * lineHeight}
          textAnchor="middle"
          fontSize={label.size}
          fontWeight={800}
          fill={ink}
          style={{ letterSpacing: '-0.02em' }}
        >
          {line}
        </text>
      ))}
      {label.strength && (
        <text
          x={cx}
          y={top + label.lines.length * lineHeight + 4}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill={ink}
          opacity={0.7}
        >
          {label.strength}
        </text>
      )}
    </>
  );
}

function BrandBand({ label, cx, y, size = 10 }: { label: Label; cx: number; y: number; size?: number }) {
  if (!label.brand) return null;
  return (
    <text
      x={cx}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={700}
      fill="#ffffff"
      style={{ letterSpacing: '0.08em' }}
    >
      {label.brand.toUpperCase()}
    </text>
  );
}

function Carton({ fg, label }: { fg: string; label: Label }) {
  return (
    <>
      {/* Top and side faces give the box depth without a perspective transform. */}
      <polygon points="46,44 62,32 162,32 146,44" fill={fg} opacity={0.55} />
      <polygon points="146,44 162,32 162,162 146,174" fill={fg} opacity={0.75} />
      <rect x={46} y={44} width={100} height={130} fill="#ffffff" />
      <rect x={46} y={44} width={100} height={24} fill={fg} />
      <BrandBand label={label} cx={96} y={60} />
      <NameBlock label={label} cx={96} top={label.lines.length > 2 ? 90 : 98} ink="#0f172a" />
      <rect x={46} y={164} width={100} height={10} fill={fg} opacity={0.85} />
      <rect x={46} y={44} width={100} height={130} fill="none" stroke={fg} strokeOpacity={0.35} />
    </>
  );
}

function Bottle({ fg, label }: { fg: string; label: Label }) {
  return (
    <>
      <rect x={77} y={22} width={46} height={20} rx={4} fill={fg} />
      <rect x={84} y={40} width={32} height={16} fill={fg} opacity={0.55} />
      <path
        d="M84 56 L70 76 Q66 82 66 92 L66 168 Q66 178 76 178 L124 178 Q134 178 134 168 L134 92 Q134 82 130 76 L116 56 Z"
        fill={fg}
        opacity={0.18}
        stroke={fg}
        strokeOpacity={0.5}
      />
      <rect x={66} y={92} width={68} height={66} fill="#ffffff" />
      <rect x={66} y={92} width={68} height={7} fill={fg} />
      <NameBlock label={label} cx={100} top={label.lines.length > 2 ? 113 : 120} ink="#0f172a" />
    </>
  );
}

function Tube({ fg, label }: { fg: string; label: Label }) {
  return (
    <>
      {/* A tube stands on its cap, crimp at the top. */}
      <path d="M58 30 L142 30 L132 158 L68 158 Z" fill="#ffffff" stroke={fg} strokeOpacity={0.45} />
      <path
        d="M58 30 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7"
        fill="none"
        stroke={fg}
        strokeOpacity={0.6}
        strokeWidth={2}
      />
      <rect x={60} y={44} width={80} height={20} fill={fg} />
      <BrandBand label={label} cx={100} y={58} />
      <NameBlock label={label} cx={100} top={label.lines.length > 2 ? 86 : 94} ink="#0f172a" />
      <rect x={84} y={158} width={32} height={22} rx={3} fill={fg} />
    </>
  );
}

function Sachet({ fg, label }: { fg: string; label: Label }) {
  return (
    <>
      <path
        d="M56 34 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 L146 172 L54 172 Z"
        fill="#ffffff"
        stroke={fg}
        strokeOpacity={0.45}
      />
      <rect x={54} y={40} width={92} height={22} fill={fg} />
      <BrandBand label={label} cx={100} y={55} />
      <NameBlock label={label} cx={100} top={label.lines.length > 2 ? 90 : 100} ink="#0f172a" />
      <rect x={54} y={160} width={92} height={12} fill={fg} opacity={0.85} />
    </>
  );
}

function Tin({ fg, label }: { fg: string; label: Label }) {
  return (
    <>
      <rect x={66} y={34} width={68} height={140} fill="#ffffff" stroke={fg} strokeOpacity={0.45} />
      <ellipse cx={100} cy={34} rx={34} ry={9} fill={fg} />
      <ellipse cx={100} cy={174} rx={34} ry={9} fill={fg} opacity={0.6} />
      <rect x={66} y={46} width={68} height={18} fill={fg} opacity={0.9} />
      <BrandBand label={label} cx={100} y={59} size={9} />
      <NameBlock label={label} cx={100} top={label.lines.length > 2 ? 90 : 100} ink="#0f172a" />
    </>
  );
}

const BODIES = { carton: Carton, bottle: Bottle, tube: Tube, sachet: Sachet, tin: Tin } as const;

export interface PackShotProps {
  product: Pick<Product, 'name' | 'strength' | 'brand' | 'form' | 'unitLabel' | 'categoryIds'>;
  className?: string | undefined;
}

export function PackShot({ product, className }: PackShotProps) {
  const shape = shapeFor(product);
  const { fg } = tintFor(product.categoryIds);

  // Bottles and tins are narrower than cartons, so they wrap sooner.
  const maxChars = shape === 'carton' || shape === 'sachet' ? 11 : 9;
  const lines = wrap(product.name, maxChars, 3);
  const label: Label = {
    // A generic product carries no brand text in the band; its name is the brand.
    brand: product.brand && product.brand.name !== product.name ? product.brand.name : null,
    lines,
    size: nameSize(lines),
    strength: product.strength,
  };

  const Body = BODIES[shape];

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden="true"
      focusable="false"
      // Inherits the page's Archivo, so the pack typography matches the site.
      style={{ fontFamily: 'inherit' }}
    >
      {/* Soft floor shadow grounds the pack on the tile. */}
      <ellipse cx={100} cy={186} rx={58} ry={6} fill="#0f172a" opacity={0.08} />
      <Body fg={fg} label={label} />
    </svg>
  );
}
