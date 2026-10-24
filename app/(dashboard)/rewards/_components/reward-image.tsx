'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Shown when a coupon has no product image, or its image fails to load. */
export const DEFAULT_REWARD_IMAGE = '/images/reward-default.webp';

/** A coupon's product image, falling back to the HunterX reward emblem (same default as the app). */
export function RewardImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  // Remembers which URL failed, so picking a new image retries without a reset.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const useDefault = !src || failedSrc === src;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-[#1A1C20]', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves it already compressed; previews are local blob: URLs */}
      <img
        src={useDefault ? DEFAULT_REWARD_IMAGE : src}
        alt={alt}
        className={cn('h-full w-full', useDefault ? 'object-contain p-[12%]' : 'object-cover')}
        onError={() => setFailedSrc(src ?? null)}
      />
    </div>
  );
}
