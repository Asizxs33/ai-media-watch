import type { Post, Category, RequisiteType } from '../types';
import type { AnalystTone } from '../store/useAppStore';

interface ResultLike {
  username?: string;
  category?: Category;
  riskScore?: number;
  detectedMarkers?: string[];
  requisites?: { type: RequisiteType; value: string }[];
}

const catWord: Record<Category, string> = {
  safe: 'безопасный контент',
  casino: 'рекламу казино',
  pyramid: 'пирамиду',
  fraud: 'мошенничество',
};

const reqWord: Record<RequisiteType, string> = {
  kaspi: 'Kaspi-номер', card: 'номер карты', crypto: 'крипто-кошелёк',
  telegram: 'Telegram', whatsapp: 'WhatsApp', phone: 'телефон',
  link: 'ссылку', promo: 'промокод', other: 'реквизит',
};

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');

const safeOpeners = ['Проверил', 'Глянул', 'Просканировал'];
const threatOpeners = ['⚠ Засёк', '⚠ Поймал', '⚠ Обнаружил'];
const warnOpeners = ['Подозрительно —', 'На карандаш:', 'Сомнительно —'];

/**
 * Собирает живой комментарий «офицера ИИ» по результату анализа.
 * existing — посты ДО добавления текущего (для кросс-ссылки на реестр).
 */
export function composeAnalystComment(
  result: ResultLike,
  existing: Post[]
): { text: string; tone: AnalystTone } {
  const {
    username = '', category = 'safe', riskScore = 0,
    detectedMarkers = [], requisites = [],
  } = result;
  const user = username ? `@${username}` : 'аккаунт';

  // Кросс-ссылка: засветился ли реквизит уже в других схемах?
  let netHit: { req: { type: RequisiteType; value: string }; count: number } | null = null;
  for (const req of requisites) {
    const n = norm(req.value);
    const prior = existing.filter((p) => (p.requisites ?? []).some((r) => norm(r.value) === n)).length;
    if (prior > 0 && (!netHit || prior + 1 > netHit.count)) {
      netHit = { req, count: prior + 1 };
    }
  }
  const netLine = netHit
    ? ` ${reqWord[netHit.req.type]} ${netHit.req.value} уже в ${netHit.count} схемах — это сеть!`
    : '';

  const markers = detectedMarkers.slice(0, 2).join(', ');
  const markerLine = markers ? ` Маркеры: ${markers}.` : '';

  if (riskScore >= 60) {
    return {
      tone: 'threat',
      text: `${pick(threatOpeners)} ${user} — ${catWord[category]}, риск ${riskScore}.${markerLine}${netLine} Готовлю передачу в АРРФР.`,
    };
  }
  if (riskScore >= 30) {
    return {
      tone: 'warn',
      text: `${pick(warnOpeners)} ${user}, риск ${riskScore}.${markerLine}${netLine}`,
    };
  }
  return {
    tone: 'safe',
    text: `${pick(safeOpeners)} ${user} — чисто, риск ${riskScore}. Иду дальше.`,
  };
}
