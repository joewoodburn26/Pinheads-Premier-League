"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SHOWDOWN = /^(https:\/\/play\.pokemonshowdown\.com\/sprites)\/[a-z0-9-]+\/([^/]+?)\.(gif|png)$/i;

/**
 * Links to try, in order, so a sprite never shows broken: the Showdown sprite,
 * Showdown's pixel animation, its still image, then the same with the hyphen
 * dropped from the name (Showdown writes Ting-Lu as "tinglu").
 */
export function spriteCandidates(url: string): string[] {
  const m = SHOWDOWN.exec(url);
  if (!m) return [url];
  const [, root, file] = m;
  const bare = file.replace(/-/g, "");
  // gen5ani has pixel-art animations for some Pokémon missing from ani; home has a still of every Pokémon
  const list = [url, `${root}/gen5ani/${file}.gif`, `${root}/home/${file}.png`];
  if (bare !== file) list.push(`${root}/ani/${bare}.gif`, `${root}/home/${bare}.png`);
  return [...new Set(list)];
}

/** Still-image versions first (Showdown's "home" pictures), the animated ones as a last resort. */
export function stillCandidates(url: string): string[] {
  const m = SHOWDOWN.exec(url);
  if (!m) return [url];
  const [, root, file] = m;
  const bare = file.replace(/-/g, "");
  return [...new Set([`${root}/home/${file}.png`, `${root}/home/${bare}.png`, ...spriteCandidates(url)])];
}

// ── Phones and tablets (touch screens) ────────────────────────────────────────

// Any touch screen, including iPads with a keyboard trackpad attached
const TOUCH_QUERY = "(any-pointer: coarse)";
const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(TOUCH_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/** true on phones/tablets, false on computers, null until the page knows (server render). */
export function useTouchScreen(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    // iPadOS sometimes reports a fine pointer; it always reports touch points
    () => window.matchMedia(TOUCH_QUERY).matches || navigator.maxTouchPoints > 1,
    () => null,
  );
}

/**
 * A Pokémon's sprite that never shows a broken image (falls back to the first
 * letter of the name). With `stillOnTouch`, phones and tablets get a still image
 * instead of the animation: hundreds of moving sprites can crash a phone's browser.
 */
export function PokemonSprite({
  src,
  name,
  className = "",
  size = 96,
  stillOnTouch = false,
}: {
  src: string;
  name: string;
  /** Include a size-* class to size it with CSS instead of `size` */
  className?: string;
  size?: number;
  stillOnTouch?: boolean;
}) {
  const touch = useTouchScreen();
  const still = stillOnTouch && touch === true;
  const candidates = still ? stillCandidates(src) : spriteCandidates(src);
  const [failed, setFailed] = useState<{ list: string; step: number }>({ list: "", step: 0 });
  const listKey = candidates.join("|");
  const step = failed.list === listKey ? failed.step : 0;
  const current = candidates[step];
  const next = () => setFailed({ list: listKey, step: step + 1 });
  const ref = useRef<HTMLImageElement>(null);
  const sized = /(^|\s|:)!?size-/.test(className);
  const box = sized ? undefined : { width: size, height: size };

  // An image that failed before React took over the page never fires onError
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Don't start the animated download before we know whether this is a phone
  if (stillOnTouch && touch === null) {
    return <span className={`inline-block shrink-0 ${className}`} style={box} aria-label={name} />;
  }

  if (!current) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-full bg-muted font-black text-muted-foreground ${className}`}
        style={{ ...box, fontSize: size / 3 }}
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
      onError={next}
      className={`object-contain ${className}`}
      style={box}
    />
  );
}
