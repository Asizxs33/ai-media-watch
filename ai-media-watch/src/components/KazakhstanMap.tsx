import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

// Vertex coordinates for perfect topological alignment (no gaps, no overlaps)
const V: Record<string, number[]> = {
  wko_top_left: [15, 168],
  wko_top_mid: [52, 140],
  wko_top_right: [132, 115],
  wko_mid_right: [162, 208],
  wko_bot_right: [140, 310],
  wko_bot_mid: [68, 338],
  wko_bot_left: [15, 298],

  atyrau_mid_right: [162, 345],
  atyrau_mid_right_2: [138, 435],
  atyrau_bot_right: [108, 452],
  atyrau_bot_mid: [96, 462],
  atyrau_bot_left: [38, 476],
  atyrau_mid_left: [12, 420],

  mangystau_mid_right: [138, 495],
  mangystau_bot_right: [124, 550],
  mangystau_bot_left: [58, 556],
  mangystau_mid_left: [22, 522],

  aktobe_top_mid: [205, 60],
  aktobe_top_right: [300, 68],
  aktobe_mid_right: [322, 208],
  aktobe_bot_right: [285, 345],

  kostanay_top_mid: [378, 20],
  kostanay_top_right: [435, 48],
  kostanay_mid_right: [412, 162],
  kostanay_bot_right: [348, 178],

  nko_top_right: [562, 15],
  nko_mid_right: [612, 40],
  nko_bot_right: [588, 128],
  nko_bot_left: [498, 142],

  akmola_mid_right: [625, 208],
  akmola_bot_right: [588, 282],
  akmola_bot_mid: [500, 292],
  akmola_bot_left: [410, 282],
  akmola_mid_left: [340, 208],

  pavlodar_top_right: [722, 48],
  pavlodar_mid_right: [755, 112],
  pavlodar_bot_right: [742, 198],
  pavlodar_bot_mid: [672, 215],

  eko_top_right: [895, 62],
  eko_mid_right: [895, 372],
  eko_bot_right: [812, 396],
  eko_bot_mid: [738, 342],
  eko_bot_left: [692, 252],

  karaganda_mid_right: [692, 392],
  karaganda_bot_right: [612, 432],
  karaganda_bot_mid: [488, 442],
  karaganda_bot_left: [365, 422],
  karaganda_mid_left_2: [278, 352],

  kyzylorda_bot_right: [328, 502],
  kyzylorda_bot_mid_2: [248, 518],
  kyzylorda_bot_mid_1: [165, 498],

  turkestan_mid_right: [475, 528],
  turkestan_bot_right: [415, 555],
  turkestan_bot_mid: [312, 548],

  zhambyl_mid_right: [648, 488],
  zhambyl_bot_right: [605, 552],
  zhambyl_bot_left: [478, 558],

  almaty_top_right_2: [895, 372],
  almaty_bot_right: [895, 558],
  almaty_bot_left: [755, 558]
};

// Polyline generator from vertex keys
function poly(...points: number[][]): string {
  return points.map(p => p.join(',')).join(' L ');
}

// Exact 14 region paths reconstructed with shared vertices
const PATH_WKO = `M ${poly(V.wko_bot_left, V.wko_bot_mid, V.wko_bot_right, V.wko_mid_right, V.wko_top_right, V.wko_top_mid, V.wko_top_left)} Z`;
const PATH_ATYRAU = `M ${poly(V.wko_bot_left, V.wko_bot_mid, V.wko_bot_right, V.atyrau_mid_right, V.atyrau_mid_right_2, V.atyrau_bot_right, V.atyrau_bot_mid, V.atyrau_bot_left, V.atyrau_mid_left)} Z`;
const PATH_MANGYSTAU = `M ${poly(V.atyrau_bot_left, V.atyrau_bot_mid, V.mangystau_mid_right, V.mangystau_bot_right, V.mangystau_bot_left, V.mangystau_mid_left)} Z`;
const PATH_AKTOBE = `M ${poly(V.wko_top_right, V.aktobe_top_mid, V.aktobe_top_right, V.aktobe_mid_right, V.aktobe_bot_right, V.atyrau_mid_right, V.wko_bot_right, V.wko_mid_right)} Z`;
const PATH_KOSTANAY = `M ${poly(V.aktobe_top_mid, V.kostanay_top_mid, V.kostanay_top_right, V.kostanay_mid_right, V.kostanay_bot_right, V.aktobe_top_right)} Z`;
const PATH_NKO = `M ${poly(V.kostanay_top_mid, V.nko_top_right, V.nko_mid_right, V.nko_bot_right, V.nko_bot_left, V.kostanay_top_right)} Z`;
const PATH_AKMOLA = `M ${poly(V.kostanay_bot_right, V.kostanay_mid_right, V.nko_bot_left, V.nko_bot_right, V.akmola_mid_right, V.akmola_bot_right, V.akmola_bot_mid, V.akmola_bot_left, V.akmola_mid_left)} Z`;
const PATH_PAVLODAR = `M ${poly(V.nko_bot_right, V.nko_mid_right, V.pavlodar_top_right, V.pavlodar_mid_right, V.pavlodar_bot_right, V.pavlodar_bot_mid, V.akmola_mid_right)} Z`;
const PATH_EKO = `M ${poly(V.pavlodar_top_right, V.eko_top_right, V.eko_mid_right, V.eko_bot_right, V.eko_bot_mid, V.eko_bot_left, V.pavlodar_bot_right, V.pavlodar_mid_right)} Z`;
const PATH_KARAGANDA = `M ${poly(V.akmola_mid_left, V.akmola_bot_left, V.akmola_bot_mid, V.akmola_bot_right, V.akmola_mid_right, V.pavlodar_bot_mid, V.eko_bot_left, V.karaganda_mid_right, V.karaganda_bot_right, V.karaganda_bot_mid, V.karaganda_bot_left, V.aktobe_bot_right, V.karaganda_mid_left_2, V.aktobe_mid_right)} Z`;
const PATH_KYZYLORDA = `M ${poly(V.atyrau_mid_right, V.aktobe_bot_right, V.karaganda_mid_left_2, V.karaganda_bot_left, V.kyzylorda_bot_right, V.kyzylorda_bot_mid_2, V.kyzylorda_bot_mid_1, V.atyrau_bot_right, V.atyrau_bot_mid, V.atyrau_mid_right_2)} Z`;
const PATH_TURKESTAN = `M ${poly(V.kyzylorda_bot_mid_2, V.karaganda_bot_left, V.karaganda_bot_mid, V.turkestan_mid_right, V.turkestan_bot_right, V.turkestan_bot_mid, V.kyzylorda_bot_right)} Z`;
const PATH_ZHAMBYL = `M ${poly(V.turkestan_mid_right, V.karaganda_bot_mid, V.karaganda_bot_right, V.zhambyl_mid_right, V.zhambyl_bot_right, V.zhambyl_bot_left)} Z`;
const PATH_ALMATY = `M ${poly(V.karaganda_bot_right, V.karaganda_mid_right, V.eko_bot_right, V.almaty_top_right_2, V.almaty_bot_right, V.almaty_bot_left, V.zhambyl_mid_right)} Z`;

interface RegionItem {
  id: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
}

const REGIONS: RegionItem[] = [
  { id: 'wko', name: 'Западно-Казахстанская', path: PATH_WKO, cx: 72, cy: 220 },
  { id: 'atyrau', name: 'Атырауская', path: PATH_ATYRAU, cx: 56, cy: 388 },
  { id: 'mangystau', name: 'Мангистауская', path: PATH_MANGYSTAU, cx: 76, cy: 510 },
  { id: 'aktobe', name: 'Актюбинская', path: PATH_AKTOBE, cx: 212, cy: 210 },
  { id: 'kostanay', name: 'Костанайская', path: PATH_KOSTANAY, cx: 332, cy: 108 },
  { id: 'nko', name: 'Северо-Казахстанская', path: PATH_NKO, cx: 492, cy: 72 },
  { id: 'akmola', name: 'Акмолинская', path: PATH_AKMOLA, cx: 490, cy: 212 },
  { id: 'pavlodar', name: 'Павлодарская', path: PATH_PAVLODAR, cx: 672, cy: 135 },
  { id: 'eko', name: 'Восточно-Казахстанская', path: PATH_EKO, cx: 808, cy: 222 },
  { id: 'karaganda', name: 'Карагандинская', path: PATH_KARAGANDA, cx: 492, cy: 348 },
  { id: 'kyzylorda', name: 'Кызылординская', path: PATH_KYZYLORDA, cx: 240, cy: 428 },
  { id: 'turkestan', name: 'Туркестанская', path: PATH_TURKESTAN, cx: 385, cy: 492 },
  { id: 'zhambyl', name: 'Жамбылская', path: PATH_ZHAMBYL, cx: 558, cy: 495 },
  { id: 'almaty', name: 'Алматинская', path: PATH_ALMATY, cx: 758, cy: 468 },
];

const CITIES = [
  { name: 'Астана', x: 505, y: 208, capital: true },
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

  // Count fraud/threat posts per region (mapping 7-zone data store values to 14 oblasts)
  const regionCount: Record<string, number> = {};
  posts.forEach(p => {
    if (!p.region || p.category === 'safe') return;

    if (p.region === 'west') {
      ['wko', 'atyrau', 'mangystau', 'aktobe'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'north') {
      ['kostanay', 'nko', 'akmola', 'pavlodar'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'east') {
      ['eko'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'center') {
      ['karaganda'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'almaty') {
      ['almaty'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'astana') {
      ['akmola'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
    } else if (p.region === 'shymkent') {
      ['turkestan', 'zhambyl', 'kyzylorda'].forEach(id => {
        regionCount[id] = (regionCount[id] || 0) + 1;
      });
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
    return 'rgba(14, 30, 20, 0.65)';
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
        <rect width="910" height="570" fill="url(#bg-grad)" />
        <rect width="910" height="570" fill="url(#dots)" />

        {/* Outer glow aura */}
        <g filter="url(#glow-soft)" opacity="0.3">
          {REGIONS.map(r => (
            <path key={r.id + '-aura'} d={r.path} fill="none" stroke="#ceff1a" strokeWidth="6" />
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
              style={{ transition: 'all 0.25s' }}
              filter={hovered === r.id ? 'url(#glow-strong)' : undefined}
            />
            {/* Count badge if fraud detected */}
            {(regionCount[r.id] || 0) > 0 && (
              <text
                x={r.cx} y={r.cy}
                textAnchor="middle" dominantBaseline="middle"
                fill="#ceff1a" fontSize="10.5" fontWeight="700"
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
              x={Math.min(hoveredRegion.cx - 70, 760)}
              y={Math.max(hoveredRegion.cy - 50, 10)}
              width="140" height="36" rx="6"
              fill="#0e1a12" stroke="#ceff1a33"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
            />
            <text
              x={Math.min(hoveredRegion.cx, 830)}
              y={Math.max(hoveredRegion.cy - 36, 24)}
              textAnchor="middle" fill="#ceff1a"
              fontSize="10.5" fontWeight="600"
            >
              {hoveredRegion.name}
            </text>
            <text
              x={Math.min(hoveredRegion.cx, 830)}
              y={Math.max(hoveredRegion.cy - 22, 38)}
              textAnchor="middle" fill="#999"
              fontSize="9"
            >
              {regionCount[hoveredRegion.id] ? `угроз: ${regionCount[hoveredRegion.id]}` : 'нет угроз'}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'rgba(10,20,15,0.75)', padding: '6px 10px',
        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)'
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
