import type { AssetBundle } from '../../client/assets/index.js';

import { resolvePlayerTankVisual } from './tank-visual-definition.js';

export function TankPreview({
  code,
  primaryColor = '#5d7d46',
  secondaryColor = '#e8c65a',
  visualResources,
}: {
  code: string;
  primaryColor?: string;
  secondaryColor?: string;
  visualResources?: AssetBundle;
}) {
  const definition = resolvePlayerTankVisual(code, visualResources);
  const { hull, turret } = definition;
  const hullX = 12;
  const hullY = 36 - hull.height / 2;
  const turretX = hullX + hull.width * 0.54;

  return (
    <svg
      aria-hidden="true"
      className="tank-preview"
      data-tank-visual={definition.code}
      viewBox="0 0 120 72"
    >
      <ellipse cx="57" cy="57" fill="#111a16" opacity="0.38" rx="43" ry="8" />
      <rect
        fill="#282c29"
        height={Math.max(6, hull.height * 0.22)}
        rx="3"
        width={hull.width + 8}
        x={hullX - 4}
        y={hullY}
      />
      <rect
        fill="#282c29"
        height={Math.max(6, hull.height * 0.22)}
        rx="3"
        width={hull.width + 8}
        x={hullX - 4}
        y={hullY + hull.height - Math.max(6, hull.height * 0.22)}
      />
      <rect
        fill={primaryColor}
        height={hull.height}
        rx={hull.cornerRadius}
        stroke="#f4f7e844"
        width={hull.width}
        x={hullX}
        y={hullY}
      />
      <path
        d={`M ${hullX + 6} ${hullY + hull.height / 2} H ${hullX + hull.width - 7}`}
        stroke={secondaryColor}
        strokeWidth="3"
      />
      <rect
        fill={secondaryColor}
        height={turret.barrelWidth}
        rx={turret.barrelWidth / 2}
        width={turret.barrelLength}
        x={turretX}
        y={36 - turret.barrelWidth / 2}
      />
      <circle
        cx={turretX}
        cy="36"
        fill={primaryColor}
        r={turret.radius}
        stroke={secondaryColor}
        strokeWidth="3"
      />
      <TankDetails
        code={definition.code}
        color={secondaryColor}
        x={hullX}
        y={hullY}
      />
    </svg>
  );
}

function TankDetails({
  code,
  color,
  x,
  y,
}: {
  code: string;
  color: string;
  x: number;
  y: number;
}) {
  if (code === 'swift-fox') {
    return (
      <path
        d={`M ${x + 8} ${y + 5} l 5 -7 l 5 7 M ${x + 24} ${y + 5} l 5 -7 l 5 7`}
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
    );
  }
  if (code === 'iron-mountain') {
    return (
      <path
        d={`M ${x + 4} ${y + 7} H ${x + 22} M ${x + 4} ${y + 13} H ${x + 18}`}
        stroke={color}
        strokeWidth="4"
      />
    );
  }
  return (
    <path
      d={`M ${x + 13} ${y + 5} l 2.5 5 l 5.5 0.8 l -4 3.8 l 1 5.4 l -5 -2.6 l -5 2.6 l 1 -5.4 l -4 -3.8 l 5.5 -0.8 z`}
      fill={color}
    />
  );
}
