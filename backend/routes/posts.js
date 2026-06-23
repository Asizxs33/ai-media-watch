import { Router } from 'express';
import { getPosts, getPostById, deletePost, getStats, updatePostStatus } from '../services/db.js';

export const postsRouter = Router();

// GET /api/posts — all posts from DB
postsRouter.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const offset = Number(req.query.offset ?? 0);
    const posts = await getPosts({ limit, offset });
    res.json({ success: true, posts, total: posts.length });
  } catch (err) {
    console.error('[/posts]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/posts/stats
postsRouter.get('/stats', async (_req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/posts/:id
postsRouter.get('/:id', async (req, res) => {
  try {
    const post = await getPostById(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/posts/:id/status
postsRouter.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'reviewed', 'blocked'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await updatePostStatus(req.params.id, status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/posts/:id
postsRouter.delete('/:id', async (req, res) => {
  try {
    await deletePost(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
