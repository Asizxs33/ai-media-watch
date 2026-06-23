import type { Region } from '../types';

export function detectRegion(text: string): Region {
  const t = text.toLowerCase();
  
  if (t.includes('алмат') || t.includes('almaty') || t.includes('медео') || t.includes('коктюбе') || t.includes('шымбулак')) {
    return 'almaty';
  }
  if (t.includes('астан') || t.includes('astana') || t.includes('нур-султан') || t.includes('байтерек') || t.includes('экспо')) {
    return 'astana';
  }
  if (t.includes('шымкент') || t.includes('shymkent') || t.includes('туркестан') || t.includes('turkestan')) {
    return 'shymkent';
  }
  if (t.includes('атырау') || t.includes('актау') || t.includes('актобе') || t.includes('уральск') || t.includes('орал') || t.includes('запад') || t.includes('west')) {
    return 'west';
  }
  if (t.includes('семей') || t.includes('усть-каменогорск') || t.includes('оскемен') || t.includes('павлодар') || t.includes('восток') || t.includes('east')) {
    return 'east';
  }
  if (t.includes('костанай') || t.includes('петропавловск') || t.includes('кокшетау') || t.includes('север') || t.includes('north')) {
    return 'north';
  }
  if (t.includes('караганд') || t.includes('жезказган') || t.includes('темиртау') || t.includes('центр') || t.includes('center')) {
    return 'center';
  }
  
  // Deterministic fallback based on string length to spread them out nicely
  const regions: Region[] = ['almaty', 'astana', 'shymkent', 'west', 'east', 'north', 'center'];
  const index = Math.abs(text.length) % regions.length;
  return regions[index];
}
