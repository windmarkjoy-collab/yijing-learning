// 所有分數以千分之一百分點的整數保存，避免浮點誤差。
export const defaults = {
  version: 1, startScore: 80000, targetScore: 100000, goalDays: 60,
  dailyPositiveCap: 500, violationPenalty: 500, dailyViolationLimit: 2,
  positive: [
    { id: 'promise', name: '履行約定', points: 100 },
    { id: 'initiative', name: '主動完成', points: 200 },
    { id: 'exercise', name: '運動', points: 100 },
    { id: 'other', name: '其他正向表現', points: 100 }
  ],
  categories: ['功課拖延', '說謊隱瞞', '約定時間', '生活習慣', '偷用3C', '偷看紙本或電子漫畫'],
  exercises: ['超慢跑1500步', '伏地挺身20下', '週末與爸爸籃球鬥牛5場', '開合跳100下', '深蹲20下 × 3組', '週末自家至億載金城門口騎腳踏車往返'],
  safeguards: ['分心、忘記、執行慢不直接扣分；先給提醒與協助。', '爭議先溝通，未釐清前不列為明確違約。', '同一事件不重複扣分，運動不能抵銷或刪除違約紀錄。', '禁止羞辱與體罰，約定由爸媽與兒子共同訂定。'],
  phase2: { enabled: false, tiers: [], fallback: 'next-settlement' }
};

export function settleDay(events, rules = defaults) {
  const approved = events.filter(e => e.status === 'approved');
  // 每一正向類型每日至多一次；多項運動仍只有一筆運動加分。
  const earned = new Set(approved.filter(e => e.type === 'positive').map(e => e.positiveId));
  const positive = Math.min(rules.dailyPositiveCap,
    rules.positive.reduce((sum, p) => sum + (earned.has(p.id) ? p.points : 0), 0));
  const unique = new Set(approved.filter(e => e.type === 'violation').map(e => e.incidentId));
  if (unique.has(undefined) || unique.has('')) throw new Error('違約須提供事件識別碼');
  const violationCount = Math.min(unique.size, rules.dailyViolationLimit);
  const negative = violationCount * rules.violationPenalty;
  return { positive, negative, violationCount, delta: positive - negative };
}

export function timeline(days, rules = defaults) {
  let score = rules.startScore;
  let unlockedAt = null;
  const points = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => {
    if (!day.settlement) return { date, score, pending: true };
    // 結算保存當時規則與加扣分，不以後來的設定追溯改寫。
    score = Math.max(0, Math.min(rules.targetScore, score + day.settlement.delta));
    if (score >= rules.targetScore && !unlockedAt) unlockedAt = date;
    return { date, score, ...day.settlement };
  });
  return { score, unlockedAt, points };
}

export function entitlement(score, phase2) {
  if (!phase2.enabled) return null;
  return [...phase2.tiers].sort((a, b) => b.minimum - a.minimum).find(t => score >= t.minimum) ?? null;
}

export function entitlements(score, phase2) {
  if (!phase2.enabled) return [];
  const kinds = [...new Set(phase2.tiers.map(t => t.kind))];
  return kinds.map(kind => entitlement(score, {...phase2, tiers:phase2.tiers.filter(t => t.kind===kind)})).filter(Boolean);
}
