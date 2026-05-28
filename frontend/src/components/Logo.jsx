// Single source of truth for the logo image. Use everywhere instead of
// hard-coding /logo.png so we can swap it (e.g. dark/light) in one place.

export default function Logo({ size = 28, alt = 'Football OS', className = '', glow = true }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt={alt}
      className={`logo-img ${glow ? 'logo-img--glow' : ''} ${className}`}
      draggable={false}
    />
  );
}
