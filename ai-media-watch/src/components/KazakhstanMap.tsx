import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

// Detailed Kazakhstan SVG paths extracted from CommandCenter (viewBox 800x480)
const PATH_ALMATY = `undefined`;
const PATH_ASTANA = `undefined`;
const PATH_WEST = `undefined`;
const PATH_EAST = `undefined`;
const PATH_NORTH = `undefined`;
const PATH_CENTER = `undefined`;
const PATH_SHYMKENT = `undefined`;

interface RegionItem {
  id: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
}

const REGIONS: RegionItem[] = [
  { id: 'astana', name: 'Астана', path: PATH_ASTANA, cx: 505, cy: 164 },
  { id: 'almaty', name: 'Алматы', path: PATH_ALMATY, cx: 628, cy: 305 },
  { id: 'shymkent', name: 'Шымкент', path: PATH_SHYMKENT, cx: 447, cy: 328 },
  { id: 'west', name: 'Западный КЗ', path: PATH_WEST, cx: 130, cy: 246 },
  { id: 'east', name: 'Восточный КЗ', path: PATH_EAST, cx: 686, cy: 222 },
  { id: 'north', name: 'Северный КЗ', path: PATH_NORTH, cx: 407, cy: 144 },
  { id: 'center', name: 'Центральный КЗ', path: PATH_CENTER, cx: 514, cy: 213 },
];

const CITIES = [
  { name: 'Астана', x: 505, y: 164, capital: true },
  { name: 'Алматы', x: 628, y: 305 },
  { name: 'Шымкент', x: 447, y: 328 },
  { name: 'Актобе', x: 130, y: 246 },
  { name: 'Атырау', x: 58, y: 278 },
  { name: 'Караганда', x: 514, y: 213 },
  { name: 'Өскемен', x: 686, y: 222 },
  { name: 'Павлодар', x: 588, y: 128 },
];

export function KazakhstanMap() {
  const posts = useAppStore(s => s.posts);
  const [hovered, setHovered] = useState<string | null>(null);

  // Count fraud/threat posts per region
  const regionCount: Record<string, number> = {};
  posts.forEach(p => {
    if (p.region) {
      regionCount[p.region] = (regionCount[p.region] || 0) + 1;
    }
  });



  const getGlow = (id: string) => {
    const count = regionCount[id] || 0;
    if (count > 2) return '#ff5640'; // High threat
    if (count > 0) return '#ffb020'; // Medium threat
    return '#46e08a'; // Safe
  };

  const getFill = (id: string) => {
    const count = regionCount[id] || 0;
    if (hovered === id) return 'rgba(206, 255, 26, 0.12)';
    if (count > 2) return 'rgba(255, 86, 64, 0.08)';
    if (count > 0) return 'rgba(255, 176, 32, 0.06)';
    return 'rgba(14, 30, 20, 0.6)';
  };

  const hoveredRegion = REGIONS.find(r => r.id === hovered);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox="0 0 800 480"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-soft">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-city">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0b1710" />
            <stop offset="100%" stopColor="#060c08" />
          </radialGradient>
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#1c2f25" opacity="0.6" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="800" height="480" fill="url(#bg-grad)" />
        <rect width="800" height="480" fill="url(#dots)" />

        {/* Outer glow aura */}
        <g filter="url(#glow-soft)" opacity="0.3">
          {REGIONS.map(r => (
            <path key={r.id + '-aura'} d={r.path} fill="none" stroke="#ceff1a" strokeWidth="8" />
          ))}
        </g>

        {/* Regions */}
        {REGIONS.map(r => (
          <g key={r.id} style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <path
              d={r.path}
              fill={getFill(r.id)}
              stroke={getGlow(r.id)}
              strokeWidth={hovered === r.id ? 2.2 : 1.2}
              style={{ transition: 'all 0.25s' }}
              filter={hovered === r.id ? 'url(#glow-strong)' : undefined}
            />
            {/* Count badge if fraud detected */}
            {(regionCount[r.id] || 0) > 0 && (
              <text
                x={r.cx} y={r.cy}
                textAnchor="middle" dominantBaseline="middle"
                fill="#ceff1a" fontSize="11" fontWeight="700"
                opacity="0.95"
                style={{ pointerEvents: 'none', textShadow: '0 0 4px #000' }}
              >
                {regionCount[r.id]}
              </text>
            )}
          </g>
        ))}

        {/* City dots */}
        {CITIES.map(city => (
          <g key={city.name} filter="url(#glow-city)">
            {city.capital && (
              <circle cx={city.x} cy={city.y} r="8" fill="none" stroke="#ceff1a" strokeWidth="1" opacity="0.4">
                <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={city.x} cy={city.y} r={city.capital ? 4 : 2.5}
              fill={city.capital ? '#ceff1a' : '#7ab800'}
            >
              {!city.capital && (
                <animate attributeName="opacity" values="1;0.5;1" dur="3s" repeatCount="indefinite" />
              )}
            </circle>
          </g>
        ))}

        {/* Tooltip */}
        {hovered && hoveredRegion && (
          <g>
            <rect
              x={Math.min(hoveredRegion.cx - 70, 650)}
              y={Math.max(hoveredRegion.cy - 50, 10)}
              width="140" height="36" rx="6"
              fill="#0e1a12" stroke="#ceff1a33"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
            />
            <text
              x={Math.min(hoveredRegion.cx, 720)}
              y={Math.max(hoveredRegion.cy - 36, 24)}
              textAnchor="middle" fill="#ceff1a"
              fontSize="10.5" fontWeight="600"
            >
              {hoveredRegion.name}
            </text>
            <text
              x={Math.min(hoveredRegion.cx, 720)}
              y={Math.max(hoveredRegion.cy - 22, 38)}
              textAnchor="middle" fill="#999"
              fontSize="9"
            >
              {regionCount[hoveredRegion.id] ? `постов: ${regionCount[hoveredRegion.id]}` : 'нет данных'}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'rgba(10,20,15,0.7)', padding: '6px 10px',
        borderRadius: '6px', border: '1px border white/5'
      }}>
        {[
          { color: '#ff5640', label: 'Высокий риск (>2)' },
          { color: '#ffb020', label: 'Средний риск (>0)' },
          { color: '#46e08a', label: 'Чистая зона' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 10, color: '#f2f3f5', fontFamily: 'system-ui' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
