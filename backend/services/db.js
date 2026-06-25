import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id            TEXT        NOT NULL,
      scan_type     TEXT        NOT NULL DEFAULT 'live',
      url           TEXT,
      platform      TEXT,
      username      TEXT,
      title         TEXT,
      thumbnail     TEXT,
      view_count    INTEGER     DEFAULT 0,
      duration      INTEGER     DEFAULT 0,
      keyword       TEXT,
      risk_score    NUMERIC(5,2) DEFAULT 0,
      category      TEXT        DEFAULT 'safe',
      confidence    NUMERIC(5,2) DEFAULT 0,
      detected_markers JSONB   DEFAULT '[]',
      explanation   TEXT,
      legal_reference TEXT,
      fraud_timestamps JSONB   DEFAULT '[]',
      segments      JSONB       DEFAULT '[]',
      transcript    TEXT,
      requisites    JSONB       DEFAULT '[]',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (id, scan_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      platform TEXT,
      username TEXT,
      caption TEXT,
      url TEXT,
      thumbnail TEXT,
      thumbnail_color TEXT,
      avatar TEXT,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      risk_score NUMERIC(5,2) DEFAULT 0,
      category TEXT DEFAULT 'safe',
      scheme_types JSONB DEFAULT '[]',
      reason TEXT,
      status TEXT DEFAULT 'pending',
      keyword TEXT,
      requisites JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[db] Tables ready');
}

export async function savePost(post) {
  const {
    id, platform, username, caption, url, thumbnail, thumbnailColor, avatar,
    viewCount, likeCount, riskScore, category, schemeTypes, reason,
    status: rawStatus, keyword, requisites,
  } = post;

  // Auto-block high-risk content
  const autoStatus = rawStatus ?? (
    (riskScore ?? 0) >= 75 && (category ?? 'safe') !== 'safe' ? 'blocked' : 'pending'
  );
  const status = autoStatus;

  await pool.query(`
    INSERT INTO posts (
      id, platform, username, caption, url, thumbnail, thumbnail_color, avatar,
      view_count, like_count, risk_score, category, scheme_types, reason,
      status, keyword, requisites
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (id) DO UPDATE SET
      risk_score    = EXCLUDED.risk_score,
      category      = EXCLUDED.category,
      scheme_types  = EXCLUDED.scheme_types,
      reason        = EXCLUDED.reason,
      status        = EXCLUDED.status,
      requisites    = EXCLUDED.requisites
  `, [
    id, platform, username, caption, url, thumbnail, thumbnailColor, avatar,
    viewCount ?? 0, likeCount ?? 0,
    riskScore ?? 0, category ?? 'safe',
    JSON.stringify(schemeTypes || []),
    reason ?? '',
    status, keyword ?? '',
    JSON.stringify(requisites || []),
  ]);
}

export async function getPosts({ limit = 200, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(normalizeRow);
}

export async function getPostById(id) {
  const { rows } = await pool.query('SELECT * FROM posts WHERE id=$1', [id]);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

export async function deletePost(id) {
  await pool.query('DELETE FROM posts WHERE id=$1', [id]);
}

export async function updatePostStatus(id, status) {
  await pool.query('UPDATE posts SET status=$1 WHERE id=$2', [status, id]);
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                                        AS total,
      COUNT(*) FILTER (WHERE risk_score >= 65)        AS high_risk,
      COUNT(*) FILTER (WHERE category='casino')       AS casino,
      COUNT(*) FILTER (WHERE category='pyramid')      AS pyramid,
      COUNT(*) FILTER (WHERE category='fraud')        AS fraud,
      COUNT(*) FILTER (WHERE platform='youtube')      AS youtube,
      COUNT(*) FILTER (WHERE platform='tiktok')       AS tiktok,
      COUNT(*) FILTER (WHERE platform='instagram')    AS instagram,
      AVG(risk_score)                                 AS avg_risk
    FROM posts
  `);
  return rows[0];
}

function normalizeRow(row) {
  return {
    id: row.id,
    platform: row.platform,
    username: row.username,
    caption: row.caption,
    url: row.url,
    thumbnail: row.thumbnail,
    thumbnailColor: row.thumbnail_color,
    avatar: row.avatar,
    viewCount: row.view_count,
    likeCount: row.like_count,
    riskScore: parseFloat(row.risk_score),
    category: row.category,
    schemeTypes: row.scheme_types || [],
    reason: row.reason,
    status: row.status,
    keyword: row.keyword,
    requisites: row.requisites || [],
    timestamp: new Date(row.created_at).getTime(),
  };
}

// ── scan_results helpers ───────────────────────────────────────────────────────
export async function saveScanResult(result, scanType = 'live') {
  const {
    id, url, platform, username, title, thumbnail,
    viewCount, duration, keyword, riskScore, category, confidence,
    detectedMarkers, explanation, legalReference,
    fraudTimestamps, segments, transcript, requisites,
  } = result;

  await pool.query(`
    INSERT INTO scan_results (
      id, scan_type, url, platform, username, title, thumbnail,
      view_count, duration, keyword, risk_score, category, confidence,
      detected_markers, explanation, legal_reference,
      fraud_timestamps, segments, transcript, requisites
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    ON CONFLICT (id, scan_type) DO UPDATE SET
      risk_score       = EXCLUDED.risk_score,
      category         = EXCLUDED.category,
      confidence       = EXCLUDED.confidence,
      detected_markers = EXCLUDED.detected_markers,
      explanation      = EXCLUDED.explanation,
      fraud_timestamps = EXCLUDED.fraud_timestamps,
      segments         = EXCLUDED.segments,
      transcript       = EXCLUDED.transcript,
      requisites       = EXCLUDED.requisites
  `, [
    id, scanType, url ?? '', platform ?? '', username ?? '', title ?? '', thumbnail ?? '',
    viewCount ?? 0, duration ?? 0, keyword ?? '',
    riskScore ?? 0, category ?? 'safe', confidence ?? 0,
    JSON.stringify(detectedMarkers ?? []),
    explanation ?? '',
    legalReference ?? '',
    JSON.stringify(fraudTimestamps ?? []),
    JSON.stringify(segments ?? []),
    (transcript ?? '').slice(0, 8000),
    JSON.stringify(requisites ?? []),
  ]);
}

export async function getScanResults(scanType = 'live', limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM scan_results WHERE scan_type=$1 ORDER BY created_at DESC LIMIT $2`,
    [scanType, limit]
  );
  return rows.map(normalizeScanRow);
}

export async function clearScanResults(scanType = 'live') {
  await pool.query('DELETE FROM scan_results WHERE scan_type=$1', [scanType]);
}

function normalizeScanRow(r) {
  return {
    id:               r.id,
    scanType:         r.scan_type,
    url:              r.url,
    platform:         r.platform,
    username:         r.username,
    title:            r.title,
    thumbnail:        r.thumbnail,
    viewCount:        r.view_count,
    duration:         r.duration,
    keyword:          r.keyword,
    riskScore:        parseFloat(r.risk_score),
    category:         r.category,
    confidence:       parseFloat(r.confidence),
    detectedMarkers:  r.detected_markers ?? [],
    explanation:      r.explanation,
    legalReference:   r.legal_reference,
    fraudTimestamps:  r.fraud_timestamps ?? [],
    segments:         r.segments ?? [],
    transcript:       r.transcript,
    requisites:       r.requisites ?? [],
    state:            'done',
    createdAt:        new Date(r.created_at).getTime(),
  };
}

export default pool;
