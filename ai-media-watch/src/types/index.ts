export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Category = 'safe' | 'casino' | 'pyramid' | 'fraud';
export type PostStatus = 'pending' | 'reviewed' | 'blocked';

export type RequisiteType =
  | 'kaspi' | 'card' | 'crypto' | 'telegram' | 'whatsapp' | 'phone' | 'link' | 'promo' | 'other';

export interface Requisite {
  type: RequisiteType;
  value: string;
}

export type Region = 'almaty' | 'astana' | 'shymkent' | 'west' | 'east' | 'north' | 'center';

export interface Post {
  id: string;
  platform: Platform;
  username: string;
  avatar: string;
  caption: string;
  hashtags: string[];
  thumbnailColor: string;
  videoTranscript: string;
  ocrText: string;
  riskScore: number;
  category: Category;
  detectedMarkers: string[];
  timestamp: string;
  status: PostStatus;
  views?: number;
  likes?: number;
  url?: string;
  requisites?: Requisite[];
  region?: Region;
}

export interface TrendScheme {
  id: string;
  hashtag: string;
  postCount: number;
  growthPercent: number;
  dailyData: { day: string; count: number }[];
  relatedAccounts: { username: string; avatar: string }[];
  commonPattern: string;
  category: Category;
}

export interface LogLine {
  id: string;
  text: string;
  type: 'process' | 'warning' | 'error' | 'success' | 'info';
  timestamp: string;
}

export interface ScanStats {
  total: number;
  safe: number;
  suspicious: number;
  fraud: number;
}
