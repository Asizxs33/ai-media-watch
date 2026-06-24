import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze.js';
import { livescanRouter } from './routes/livescan.js';
import { postsRouter } from './routes/posts.js';
import { initDb } from './services/db.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS: список доменов через запятую в CORS_ORIGINS (.env).
// Если переменная не задана — пускаем всех (удобно для демо через туннель).
const corsEnv = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const allowedOrigins = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:5174', 'http://127.0.0.1:5174',
  ...corsEnv,
];
app.use(cors({
  origin: corsEnv.length === 0
    ? true
    : (origin, cb) => {
        // Allow Chrome extensions and listed origins
        if (!origin || origin.startsWith('chrome-extension://') || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'));
        }
      },
}));
app.use(express.json({ limit: '12mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    model: process.env.ANTHROPIC_API_KEY ? 'Claude AI' : null,
  });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/livescan', livescanRouter);
app.use('/api/posts', postsRouter);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

initDb().catch(err => console.error('[db] Init failed:', err.message));

app.listen(PORT, () => {
  console.log(`\n🚀 Spectra AI Backend — http://localhost:${PORT}`);
  console.log(`   Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅ настроен' : '❌ не задан (ANTHROPIC_API_KEY)'}`);
  console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ настроен' : '⚠️  не задан (Whisper недоступен)'}`);
  console.log(`   Database:   ${process.env.DATABASE_URL ? '✅ Neon PostgreSQL' : '❌ не задан (DATABASE_URL)'}\n`);
});
