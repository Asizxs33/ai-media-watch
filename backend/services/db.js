import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function initDb() {
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
    status = 'pending', keyword, requisites,
  } = post;

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

export default pool;
