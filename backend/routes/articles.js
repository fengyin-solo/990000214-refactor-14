const express = require('express');
const { getDb } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Number of recent articles returned by the stats endpoint
const RECENT_ARTICLES_LIMIT = 5;

// Shared processing: split a raw article row's comma-separated tags into an array
function parseArticle(article) {
  return {
    ...article,
    tags: article.tags ? article.tags.split(',').map(t => t.trim()) : []
  };
}

// Shared processing: collect the sorted list of unique tags across all articles
function getAllTags(db) {
  const articles = db.prepare("SELECT tags FROM articles WHERE tags IS NOT NULL AND tags != ''").all();
  const tagSet = new Set();

  articles.forEach(article => {
    if (article.tags) {
      article.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    }
  });

  return Array.from(tagSet).sort();
}

// GET /api/articles - List articles with pagination, tag filter and search
router.get('/', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const tag = req.query.tag || null;
  const search = req.query.search || null;
  const offset = (page - 1) * limit;

  let countQuery, articlesQuery;
  let params = [];
  let countParams = [];
  let whereClauses = [];

  if (tag) {
    whereClauses.push(`',' || tags || ',' LIKE ?`);
    params.push(`%,${tag},%`);
    countParams.push(`%,${tag},%`);
  }

  if (search) {
    whereClauses.push(`(title LIKE ? OR summary LIKE ?)`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  countQuery = `SELECT COUNT(*) as total FROM articles ${whereSql}`;
  articlesQuery = `SELECT id, title, summary, tags, created_at, updated_at FROM articles ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const { total } = db.prepare(countQuery).get(...countParams);
    const articles = db.prepare(articlesQuery).all(...params);

    const parsedArticles = articles.map(parseArticle);

    res.json({
      articles: parsedArticles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/articles/:id - Get single article
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(parseArticle(article));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// POST /api/articles - Create article (requires auth)
router.post('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO articles (title, body, summary, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, body, summary || '', tagsStr, now, now);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(parseArticle(article));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// PUT /api/articles/:id - Update article (requires auth)
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, body, summary, tags } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE articles SET title = ?, body = ?, summary = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(title, body, summary || '', tagsStr, now, id);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

    res.json(parseArticle(article));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/articles/:id - Delete article (requires auth)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// GET /api/tags - Get all unique tags (exported for use in server.js)
function getTags(req, res) {
  const db = getDb();

  try {
    res.json({ tags: getAllTags(db) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
}

// GET /api/stats - Dashboard statistics from a single consistent source
// (exported for use in server.js)
function getStats(req, res) {
  const db = getDb();

  try {
    const { total: totalArticles } = db.prepare('SELECT COUNT(*) as total FROM articles').get();

    // datetime() normalizes both 'YYYY-MM-DD HH:MM:SS' and ISO 8601 stored
    // values, so the weekly boundary is computed the same way for every row
    const { total: weeklyNewArticles } = db.prepare(
      `SELECT COUNT(*) as total FROM articles WHERE datetime(created_at) > datetime('now', '-7 days')`
    ).get();

    const totalTags = getAllTags(db).length;

    const recentArticles = db.prepare(
      'SELECT id, title, summary, tags, created_at, updated_at FROM articles ORDER BY datetime(created_at) DESC LIMIT ?'
    ).all(RECENT_ARTICLES_LIMIT).map(parseArticle);

    res.json({ totalArticles, totalTags, weeklyNewArticles, recentArticles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = router;
module.exports.getTags = getTags;
module.exports.getStats = getStats;
