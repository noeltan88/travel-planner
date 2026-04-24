/**
 * AttractionImage — drop-in <img> replacement for attraction photos.
 *
 * Shows the real photo when src is a valid URL.
 * Falls back to a category-keyed gradient + emoji when src is null or the
 * image fails to load (network error, 404, etc.).
 *
 * Props:
 *   src        {string|null}  image URL (null → show fallback immediately)
 *   alt        {string}       alt text / attraction name
 *   category   {string}       attraction category — drives gradient + emoji
 *   style      {object}       extra inline styles applied to the root div
 *   className  {string}       extra Tailwind / CSS classes on the root div
 *   emoji      {string}       optional emoji override (ignores category emoji)
 */
import { useState, useEffect } from 'react';

// ── Category → { gradient, emoji } ───────────────────────────────────────────
const CATEGORY_THEME = {
  // nature / outdoors
  nature:           { gradient: 'linear-gradient(135deg, #134e00 0%, #2d6a1a 50%, #4a7c2f 100%)', emoji: '🌿' },
  park:             { gradient: 'linear-gradient(135deg, #1a4a00 0%, #2d7a1a 50%, #5a9a30 100%)', emoji: '🌳' },
  scenic:           { gradient: 'linear-gradient(135deg, #0d3b4f 0%, #1a6b7a 50%, #2d9aac 100%)', emoji: '🏞️' },
  beach:            { gradient: 'linear-gradient(135deg, #1565c0 0%, #039be5 50%, #80deea 100%)', emoji: '🏖️' },
  adventure:        { gradient: 'linear-gradient(135deg, #1b4f1b 0%, #2e7d32 50%, #7cb342 100%)', emoji: '🧗' },
  'winter-sport':   { gradient: 'linear-gradient(135deg, #1a237e 0%, #3949ab 50%, #90caf9 100%)', emoji: '⛷️' },

  // culture / history
  landmark:         { gradient: 'linear-gradient(135deg, #1a0a05 0%, #2d1208 50%, #5a2d15 100%)', emoji: '🏛️' },
  museum:           { gradient: 'linear-gradient(135deg, #1c1240 0%, #311b6a 50%, #5e3b9e 100%)', emoji: '🏛️' },
  temple:           { gradient: 'linear-gradient(135deg, #3e1008 0%, #6b1f10 50%, #a34228 100%)', emoji: '🛕' },
  culture:          { gradient: 'linear-gradient(135deg, #2c1654 0%, #4a2480 50%, #7b52ab 100%)', emoji: '🎎' },
  'historic-site':  { gradient: 'linear-gradient(135deg, #2e1a0e 0%, #5a3520 50%, #8b5e3c 100%)', emoji: '🏯' },
  'historic-district': { gradient: 'linear-gradient(135deg, #2a1a0a 0%, #5a3a10 50%, #8a6030 100%)', emoji: '🏘️' },

  // urban / entertainment
  attraction:       { gradient: 'linear-gradient(135deg, #1a0a05 0%, #2d1208 55%, #0f2027 100%)', emoji: '🎡' },
  viewpoint:        { gradient: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #4040ae 100%)', emoji: '🌃' },
  'night_view':     { gradient: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a6e 50%, #4040ae 100%)', emoji: '🌃' },
  'theme-park':     { gradient: 'linear-gradient(135deg, #1a006e 0%, #3d00b0 50%, #7e57c2 100%)', emoji: '🎢' },
  'theme_park':     { gradient: 'linear-gradient(135deg, #1a006e 0%, #3d00b0 50%, #7e57c2 100%)', emoji: '🎢' },
  zoo:              { gradient: 'linear-gradient(135deg, #1b4f1b 0%, #2e7d32 50%, #8bc34a 100%)', emoji: '🦁' },
  aquarium:         { gradient: 'linear-gradient(135deg, #01579b 0%, #0288d1 50%, #4fc3f7 100%)', emoji: '🐠' },

  // shopping / food
  shopping:         { gradient: 'linear-gradient(135deg, #880e4f 0%, #c2185b 50%, #f48fb1 100%)', emoji: '🛍️' },
  market:           { gradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 50%, #ffcc80 100%)', emoji: '🏪' },
  'food_street':    { gradient: 'linear-gradient(135deg, #bf360c 0%, #e64a19 50%, #ff8a65 100%)', emoji: '🍜' },

  // misc
  experience:       { gradient: 'linear-gradient(135deg, #004d40 0%, #00796b 50%, #4db6ac 100%)', emoji: '✨' },
  'arts-district':  { gradient: 'linear-gradient(135deg, #1a0050 0%, #4a148c 50%, #9c27b0 100%)', emoji: '🎨' },
  'local-hangout':  { gradient: 'linear-gradient(135deg, #1b0a28 0%, #3e1f6e 50%, #7e57c2 100%)', emoji: '☕' },
  'hidden-gem':     { gradient: 'linear-gradient(135deg, #0d3b4f 0%, #1a5f7a 50%, #2da0c0 100%)', emoji: '💎' },
  local:            { gradient: 'linear-gradient(135deg, #1b2a1b 0%, #2e4d2e 50%, #4a7a4a 100%)', emoji: '🏡' },
};

const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)',
  emoji:    '📍',
};

function getTheme(category) {
  return CATEGORY_THEME[category] || DEFAULT_THEME;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AttractionImage({ src, alt, category, style, className, emoji }) {
  const [broken, setBroken] = useState(!src);

  // Reset broken state when src changes (e.g., after swap)
  useEffect(() => {
    setBroken(!src);
  }, [src]);

  const theme       = getTheme(category);
  const displayEmoji = emoji || theme.emoji;

  const rootStyle = {
    width:    '100%',
    height:   '100%',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  if (broken) {
    return (
      <div style={{ ...rootStyle, background: theme.gradient }} className={className}>
        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       44,
          opacity:        0.6,
        }}>
          {displayEmoji}
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle} className={className}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
