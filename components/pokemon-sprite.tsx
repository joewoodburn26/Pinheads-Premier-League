"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A Pokémon's sprite that never shows a broken image. If the Showdown sprite
 * fails it tries Showdown's pixel animation, then its still image, then the same
 * with the hyphen dropped from the name (Showdown writes Ting-Lu as "tinglu"),
 * and finally shows the first letter of the name.
 */
export function spriteCandidates(url: string): string[] {
  const m = /^(https:\/\/play\.pokemonshowdown\.com\/sprites)\/[a-z0-9-]+\/([^/]+?)\.(gif|png)$/i.exec(url);
  if (!m) return [url];
  const [, root, file] = m;
  const bare = file.replace(/-/g, "");
  // gen5ani has pixel-art animations for some Pokémon missing from ani; home has a still of every Pokémon
  const list = [url, `${root}/gen5ani/${file}.gif`, `${root}/home/${file}.png`];
  if (bare !== file) list.push(`${root}/ani/${bare}.gif`, `${root}/home/${bare}.png`);
  return [...new Set(list)];
}

export function PokemonSprite({
  src,
  name,
  className = "",
  size = 96,
}: {
  src: string;
  name: string;
  className?: string;
  size?: number;
}) {
  const [step, setStep] = useState(0);
  const candidates = spriteCandidates(src);
  const current = candidates[step];
  const ref = useRef<HTMLImageElement>(null);

  // An image that failed before React took over the page never fires onError
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setStep((s) => s + 1);
  }, [current]);

  if (!current) {
    return (
      <span
        className={`grid place-items-center rounded-full bg-muted font-black text-muted-foreground ${className}`}
        style={{ width: size, height: size, fontSize: size / 3 }}
        aria-label={name}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      ref={ref}
      src={current}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => s + 1)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
