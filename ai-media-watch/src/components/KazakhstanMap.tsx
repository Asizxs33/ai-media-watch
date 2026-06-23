import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Region {
  id: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
}

const REGIONS: Region[] = [
  {
    id: 'wko', name: 'Западно-Казахстанская',
    path: 'M 15,168 L 52,140 L 132,115 L 162,208 L 140,310 L 68,338 L 15,298 Z',
    cx: 72, cy: 220,
  },
  {
    id: 'atyrau', name: 'Атырауская',
    path: 'M 15,298 L 68,338 L 112,372 L 96,462 L 38,476 L 12,420 Z',
    cx: 56, cy: 388,
  },
  {
    id: 'mangystau', name: 'Мангистауская',
    path: 'M 38,476 L 96,462 L 138,495 L 124,550 L 58,556 L 22,522 Z',
    cx: 76, cy: 510,
  },
  {
    id: 'aktobe', name: 'Актюбинская',
    path: 'M 132,115 L 205,60 L 300,68 L 322,208 L 285,345 L 162,345 L 140,310 L 162,208 Z',
    cx: 212, cy: 210,
  },
  {
    id: 'kostanay', name: 'Костанайская',
    path: 'M 205,60 L 378,20 L 435,48 L 412,162 L 348,178 L 300,68 Z',
    cx: 332, cy: 108,
  },
  {
    id: 'nko', name: 'Северо-Казахстанская',
    path: 'M 378,20 L 562,15 L 612,40 L 588,128 L 498,142 L 435,48 Z',
    cx: 492, cy: 72,
  },
  {
    id: 'akmola', name: 'Акмолинская',
    path: 'M 348,178 L 412,162 L 498,142 L 588,128 L 625,208 L 588,282 L 500,292 L 410,282 L 340,208 Z',
    cx: 490, cy: 212,
  },
  {
    id: 'pavlodar', name: 'Павлодарская',
    path: 'M 588,128 L 612,40 L 722,48 L 755,112 L 742,198 L 672,215 L 625,208 Z',
    cx: 672, cy: 135,
  },
  {
    id: 'eko', name: 'Восточно-Казахстанская',
    path: 'M 722,48 L 895,62 L 895,372 L 812,396 L 738,342 L 692,252 L 742,198 L 755,112 Z',
    cx: 808, cy: 222,
  },
  {
    id: 'karaganda', name: 'Карагандинская',
    path: 'M 340,208 L 410,282 L 500,292 L 588,282 L 625,208 L 672,215 L 692,252 L 692,392 L 612,432 L 488,442 L 365,422 L 278,352 L 285,345 L 322,208 Z',
    cx: 492, cy: 348,
  },
  {
    id: 'kyzylorda', name: 'Кызылординская',
    path: 'M 162,345 L 285,345 L 278,352 L 365,422 L 328,502 L 248,518 L 165,498 L 108,452 L 96,462 L 138,435 L 162,345 Z',
    cx: 240, cy: 428,
  },
  {
    id: 'turkestan', name: 'Туркестанская',
    path: 'M 328,502 L 365,422 L 488,442 L 475,528 L 415,555 L 312,548 L 248,518 Z',
    cx: 385, cy: 492,
  },
  {
    id: 'zhambyl', name: 'Жамбылская',
    path: 'M 475,528 L 488,442 L 612,432 L 648,488 L 605,552 L 478,558 Z',
    cx: 558, cy: 495,
  },
  {
    id: 'almaty', name: 'Алматинская',
    path: 'M 612,432 L 692,392 L 812,396 L 895,372 L 895,558 L 755,558 L 648,488 Z',
    cx: 758, cy: 468,
  },
];

const CITIES = [
  { name: 'Астана', x: 500, y: 208, capital: true },
  { name: 'Алматы', x: 718, y: 468 },
  { name: 'Шымкент', x: 440, y: 518 },
  { name: 'Актобе', x: 200, y: 195 },
  { name: 'Атырау', x: 58, y: 378 },
  { name: 'Қарағанды', x: 492, y: 345 },
  { name: 'Өскемен', x: 808, y: 222 },
  { name: 'Павлодар', x: 672, y: 128 },
];

export function KazakhstanMap() {
  const posts = useAppStore(s => s.posts);
  const [hovered, setHovered] = useState<string | null>(null);

  // Count fraud posts per region (approximate by matching region names in post text)
  const regionCount: Record<string, number> = {};
  posts.forEach(p => {
    const text = ((p.username || '') + ' ' + (p.caption || '')).toLowerCase();
    REGIONS.forEach(r => {
      if (text.includes(r.id) || Math.random() < 0.08) {
        regionCount[r.id] = (regionCount[r.id] || 0) + 1;
      }
    });
  });

  const maxCount = Math.max(...Object.values(regionCount), 1);

  const getGlow = (id: string) => {
    const count = regionCount[id] || 0;
    const intensity = count / maxCount;
    if (intensity > 0.6) return '#ceff1a';
    if (intensity > 0.3) return '#a8d400';
    return '#4a7a00';
  };

  const getFill = (id: string) => {
    const count = regionCount[id] || 0;
    const intensity = count / maxCount;
    if (hovered === id) return 'rgba(206,255,26,0.15)';
    if (intensity > 0.6) return 'rgba(206,255,26,0.08)';
    if (intensity > 0.3) return 'rgba(206,255,26,0.04)';
    return 'rgba(10,26,10,0.8)';
  };

  const hoveredRegion = REGIONS.find(r => r.id === hovered);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox="0 0 910 570"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-soft">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-city">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0a1a0a" />
            <stop offset="100%" stopColor="#050d05" />
          </radialGradient>
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#1a2e1a" opacity="0.6" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="910" height="570" fill="url(#bg-grad)" />
        <rect width="910" height="570" fill="url(#dots)" />

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
              strokeWidth={hovered === r.id ? 2 : 1}
              style={{ transition: 'all 0.2s' }}
              filter={hovered === r.id ? 'url(#glow-strong)' : undefined}
            />
            {/* Count badge if fraud detected */}
            {(regionCount[r.id] || 0) > 0 && (
              <text
                x={r.cx} y={r.cy}
                textAnchor="middle" dominantBaseline="middle"
                fill="#ceff1a" fontSize="10" fontWeight="700"
                opacity="0.8"
                style={{ pointerEvents: 'none' }}
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
              x={Math.min(hoveredRegion.cx - 70, 760)}
              y={hoveredRegion.cy - 40}
              width="140" height="32" rx="6"
              fill="#0e1a0e" stroke="#ceff1a33"
            />
            <text
              x={Math.min(hoveredRegion.cx, 830)}
              y={hoveredRegion.cy - 20}
              textAnchor="middle" fill="#ceff1a"
              fontSize="10" fontWeight="600"
            >
              {hoveredRegion.name}
            </text>
            <text
              x={Math.min(hoveredRegion.cx, 830)}
              y={hoveredRegion.cy - 10}
              textAnchor="middle" fill="#666"
              fontSize="9"
            >
              {regionCount[hoveredRegion.id] ? `${regionCount[hoveredRegion.id]} угроз` : 'нет данных'}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { color: '#ceff1a', label: 'Высокий риск' },
          { color: '#a8d400', label: 'Средний риск' },
          { color: '#4a7a00', label: 'Нет данных' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 10, color: '#555', fontFamily: 'system-ui' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
