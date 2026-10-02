import { useState } from "react";

/**
 * Draws a product illustration in the product's colour, so the catalogue looks
 * consistent without stock photos. A real photo (image_url) is used when set.
 */
function shade(hex, amount) {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const shapes = {
  phone: (c) => (
    <g>
      <rect x="148" y="34" width="104" height="222" rx="22" fill={shade(c, -0.35)} />
      <rect x="152" y="38" width="96" height="214" rx="19" fill={c} />
      <rect x="160" y="50" width="80" height="190" rx="12" fill={shade(c, 0.78)} />
      <rect x="160" y="50" width="80" height="190" rx="12" fill="url(#glare)" />
      <rect x="186" y="56" width="28" height="7" rx="3.5" fill={shade(c, -0.35)} />
    </g>
  ),
  laptop: (c) => (
    <g>
      <rect x="92" y="58" width="216" height="146" rx="12" fill={shade(c, -0.3)} />
      <rect x="102" y="68" width="196" height="126" rx="6" fill={shade(c, 0.78)} />
      <rect x="102" y="68" width="196" height="126" rx="6" fill="url(#glare)" />
      <path d="M72 206h256l-14 22H86z" fill={c} />
      <rect x="176" y="206" width="48" height="6" rx="3" fill={shade(c, -0.3)} />
    </g>
  ),
  audio: (c) => (
    <g fill="none">
      <path d="M126 170v-30a74 74 0 0 1 148 0v30" stroke={shade(c, -0.25)} strokeWidth="16" strokeLinecap="round" />
      <rect x="104" y="150" width="50" height="86" rx="22" fill={c} />
      <rect x="246" y="150" width="50" height="86" rx="22" fill={c} />
      <rect x="114" y="162" width="18" height="62" rx="9" fill={shade(c, 0.35)} />
      <rect x="268" y="162" width="18" height="62" rx="9" fill={shade(c, 0.35)} />
    </g>
  ),
  watch: (c) => (
    <g>
      <rect x="170" y="18" width="60" height="264" rx="22" fill={shade(c, -0.3)} />
      <rect x="146" y="92" width="108" height="118" rx="30" fill={c} />
      <rect x="156" y="102" width="88" height="98" rx="22" fill="#111" />
      <circle cx="200" cy="151" r="30" fill="none" stroke={shade(c, 0.55)} strokeWidth="6" strokeDasharray="130 60" strokeLinecap="round" />
      <rect x="254" y="132" width="8" height="24" rx="4" fill={shade(c, -0.3)} />
    </g>
  ),
  gaming: (c) => (
    <g>
      <path d="M128 122h144c26 0 42 18 48 46l14 58c5 22-18 36-34 20l-30-30H130l-30 30c-16 16-39 2-34-20l14-58c6-28 22-46 48-46z" fill={c} />
      <circle cx="148" cy="170" r="16" fill={shade(c, -0.35)} />
      <g fill={shade(c, 0.7)}>
        <circle cx="256" cy="156" r="7" /><circle cx="274" cy="172" r="7" />
        <circle cx="238" cy="172" r="7" /><circle cx="256" cy="188" r="7" />
      </g>
      <rect x="186" y="150" width="28" height="8" rx="4" fill={shade(c, -0.35)} />
    </g>
  ),
  accessory: (c) => (
    <g>
      <path d="M200 216c0 34 40 30 70 48" fill="none" stroke={shade(c, -0.3)} strokeWidth="8" strokeLinecap="round" />
      <rect x="146" y="64" width="108" height="150" rx="24" fill={c} />
      <path d="M208 92l-34 52h26l-8 42 34-54h-26z" fill={shade(c, 0.8)} />
      <rect x="176" y="46" width="12" height="24" rx="4" fill={shade(c, -0.4)} />
      <rect x="212" y="46" width="12" height="24" rx="4" fill={shade(c, -0.4)} />
    </g>
  ),
};

export default function ProductArt({ product, className = "" }) {
  const color = product.color || "#1f2937";
  const kind = product.category?.kind ?? product.kind ?? "accessory";
  const [failed, setFailed] = useState(false);

  // Real photo when there is one; the drawing is the fallback if the link breaks
  if (product.image_url && !failed) {
    return (
      <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setFailed(true)}
        className={`bg-line/40 object-cover ${className}`} />
    );
  }

  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label={product.name}>
      <defs>
        <radialGradient id={`bg-${product.id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor={shade(color, 0.9)} />
          <stop offset="1" stopColor={shade(color, 0.72)} />
        </radialGradient>
        <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#bg-${product.id})`} />
      <ellipse cx="200" cy="268" rx="120" ry="10" fill={shade(color, -0.2)} opacity=".18" />
      {(shapes[kind] ?? shapes.accessory)(color)}
    </svg>
  );
}
