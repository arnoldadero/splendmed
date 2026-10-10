import Image from 'next/image';

import { LOGO_ASSETS, clearSpaceFor, scaledWidthFor, type LogoVariant } from '@/lib/brand';

/**
 * The single permitted way to render the SplendMed logo.
 *
 * The brand guideline forbids rotating, skewing, recolouring, adding shadows or
 * outlines, locking text to the logo, and altering the relationship of its
 * components. Routing every usage through this component is what makes those
 * rules enforceable — a raw img tag on a logo file bypasses them, so §6 bans it.
 *
 * Clear space is applied as padding so neighbouring content cannot encroach.
 * With the files now cropped to their real content, the guideline's 50% is
 * exact rather than added on top of hidden artboard margin.
 */

export interface LogoProps {
  /**
   * `auto` (the default) shows the full-colour mark on light backgrounds and
   * the on-dark mark in dark mode. Pass a fixed variant when the background is
   * known regardless of theme — the white logo on a teal band, for instance.
   */
  variant?: LogoVariant | 'auto';
  /** Rendered height of the mark itself, in pixels. */
  height?: number;
  /** Clear space as a fraction of height. The guideline minimum is 0.5. */
  clearSpace?: number;
  alt?: string;
  /** Set on the single above-the-fold logo so it is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}

function LogoImage({
  variant,
  height,
  alt,
  priority,
  className,
}: {
  variant: LogoVariant;
  height: number;
  alt: string;
  priority: boolean;
  className?: string;
}) {
  const asset = LOGO_ASSETS[variant];
  const width = scaledWidthFor(variant, height);
  return (
    <Image
      src={asset.src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      className={className}
      style={{ height, width }}
    />
  );
}

export function Logo({
  variant = 'auto',
  height = 40,
  clearSpace,
  alt,
  priority = false,
  className,
}: LogoProps) {
  const padding =
    clearSpace === undefined ? clearSpaceFor(height) : Math.round(height * clearSpace);
  const accessibleName =
    alt ?? (variant !== 'auto' && LOGO_ASSETS[variant].isSubmark ? '' : 'SplendMed Pharmacy');

  return (
    <span
      className={className}
      style={{ display: 'inline-block', padding, lineHeight: 0 }}
    >
      {variant === 'auto' ? (
        <>
          {/*
            Two images, one per theme, swapped with CSS. Without this the
            full-colour mark would sit on the dark-mode background at low
            contrast — the same failure that made the logo invisible before.
            Only the visible one is announced to assistive technology.
          */}
          <LogoImage
            variant="colour"
            height={height}
            alt={accessibleName}
            priority={priority}
            className="block dark:hidden"
          />
          {/*
            Same priority as the light mark, not lazy. Both sit above the fold;
            a lazy-loaded logo left the dark-mode header visibly empty until the
            browser got round to it. The cost is one extra small image.
          */}
          <LogoImage
            variant="on-dark"
            height={height}
            alt=""
            priority={priority}
            className="hidden dark:block"
          />
        </>
      ) : (
        <LogoImage variant={variant} height={height} alt={accessibleName} priority={priority} />
      )}
    </span>
  );
}
