import Image from 'next/image';

import { LOGO_ASSETS, clearSpaceFor, scaledWidthFor, type LogoVariant } from '@/lib/brand';

/**
 * The single permitted way to render the SplendMed logo.
 *
 * The brand guideline forbids rotating, skewing, recolouring, adding shadows or
 * outlines, locking text to the logo, and altering the relationship of its
 * components. Routing every usage through this component is what makes those rules
 * enforceable: a raw img tag or a CSS background on a logo file bypasses them, so
 * BUILD_SPLENDMED.md §6 bans that outright.
 *
 * Clear space is applied as padding so neighbouring content physically cannot
 * encroach on it. See docs/decisions/0002-logo-clear-space.md for the known
 * artboard-padding caveat.
 */

export interface LogoProps {
  variant?: LogoVariant;
  /** Rendered height in pixels. Width follows the asset's intrinsic ratio. */
  height?: number;
  /**
   * Accessible name. Defaults to the brand name for wordmarks, and to empty for
   * icon submarks, which marks them decorative. Pass an explicit empty string when
   * an adjacent element already names the brand.
   */
  alt?: string;
  /** Set on the single above-the-fold logo so it is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}

export function Logo({
  variant = 'primary',
  height = 40,
  alt,
  priority = false,
  className,
}: LogoProps) {
  const asset = LOGO_ASSETS[variant];
  const width = scaledWidthFor(variant, height);
  const clearSpace = clearSpaceFor(height);
  const accessibleName = alt ?? (asset.isSubmark ? '' : 'SplendMed Pharmacy');

  return (
    <span
      className={className}
      style={{ display: 'inline-block', padding: clearSpace, lineHeight: 0 }}
    >
      <Image
        src={asset.src}
        width={width}
        height={height}
        alt={accessibleName}
        priority={priority}
        style={{ height, width, display: 'block' }}
      />
    </span>
  );
}
