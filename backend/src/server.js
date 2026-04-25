const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5001);
const tmdbReadToken = process.env.TMDB_READ_TOKEN;
const adminSyncToken = process.env.ADMIN_SYNC_TOKEN;

if (!tmdbReadToken) {
  console.error('Missing TMDB_READ_TOKEN in backend environment variables.');
  process.exit(1);
}

function buildDbConfig() {
  const useSsl = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';
  const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';
  const poolLimit = Number(process.env.DB_POOL_LIMIT || 5);
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);

    // DATABASE_URL query param sslmode=require should imply SSL on providers like Aiven.
    const sslMode = parsed.searchParams.get('sslmode');
    const enableSslFromUrl = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';

    // Remove driver-specific SSL query params to prevent pg-connection-string from
    // overriding the explicit ssl config we pass below.
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('ssl');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    parsed.searchParams.delete('sslrootcert');

    return {
      connectionString: parsed.toString(),
      max: poolLimit,
      ssl: (useSsl || enableSslFromUrl) ? { rejectUnauthorized } : undefined
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: poolLimit,
    ssl: useSsl ? { rejectUnauthorized } : undefined
  };
}

const dbConfig = buildDbConfig();

const hasDbConfig = Boolean(
  dbConfig.connectionString || (dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database)
);

if (!hasDbConfig) {
  console.error('Missing DB configuration. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.');
  process.exit(1);
}

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const tmdbClient = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: {
    Authorization: `Bearer ${tmdbReadToken}`,
    'Content-Type': 'application/json'
  }
});

const IMAGE_BASE_POSTER = 'https://image.tmdb.org/t/p/w300';
const IMAGE_BASE_BACKDROP = 'https://image.tmdb.org/t/p/w1280';
const COLLECTION_TRENDING = 'trending';
const COLLECTION_MOVIES = 'movies';
const COLLECTION_SERIES = 'series';
const ALLOWED_COLLECTIONS = new Set([COLLECTION_TRENDING, COLLECTION_MOVIES, COLLECTION_SERIES]);

let dbPool;
let genreCache = {
  movie: {},
  tv: {},
  loadedAt: 0
};

const CACHE_TTL_MS = 1000 * 60 * 60;

function resolveContentId(contentId) {
  const [type, tmdbId] = String(contentId || '').split('-');

  if (!type || !tmdbId || !['movie', 'series', 'tv'].includes(type)) {
    return null;
  }

  return {
    tmdbType: type === 'movie' ? 'movie' : 'tv',
    appType: type === 'movie' ? 'movie' : 'series',
    tmdbId: Number(tmdbId),
    contentKey: `${type === 'movie' ? 'movie' : 'series'}-${Number(tmdbId)}`
  };
}

function requireAdminToken(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!adminSyncToken || token !== adminSyncToken) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  return next();
}

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'series' ? 'series' : (type === 'movie' ? 'movie' : '');
}

function normalizeCollections(type, collections) {
  if (Array.isArray(collections) && collections.length) {
    return collections.filter((item) => ALLOWED_COLLECTIONS.has(String(item || '').trim()));
  }

  return type === 'movie' ? [COLLECTION_MOVIES] : [COLLECTION_SERIES];
}

async function addContentToCollection(collectionName, contentKey) {
  const { rows } = await dbPool.query(
    'SELECT COALESCE(MAX(sort_rank), 0) + 1 AS next_rank FROM content_collections WHERE collection_name = $1',
    [collectionName]
  );

  const nextRank = Number(rows[0]?.next_rank || 1);

  await dbPool.query(
    `
    INSERT INTO content_collections (collection_name, content_key, sort_rank)
    VALUES ($1, $2, $3)
    ON CONFLICT (collection_name, content_key) DO NOTHING
    `,
    [collectionName, contentKey, nextRank]
  );
}

async function removeContentFromCollections(contentKey) {
  await dbPool.query('DELETE FROM content_collections WHERE content_key = $1', [contentKey]);
}

function pickTrailerVideo(videos) {
  const youtubeVideos = (videos || []).filter((video) => video.site === 'YouTube');

  const trailer = youtubeVideos.find((video) => video.type === 'Trailer' && video.official) ||
    youtubeVideos.find((video) => video.type === 'Trailer') ||
    youtubeVideos.find((video) => video.type === 'Teaser') ||
    youtubeVideos[0];

  if (!trailer) {
    return null;
  }

  return {
    videoKey: trailer.key,
    name: trailer.name,
    site: trailer.site,
    videoType: trailer.type,
    official: trailer.official ? 1 : 0,
    publishedAt: trailer.published_at || null,
    embedUrl: `https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`
  };
}

async function loadGenres() {
  const isCacheValid = Date.now() - genreCache.loadedAt < CACHE_TTL_MS;

  if (isCacheValid && Object.keys(genreCache.movie).length > 0) {
    return genreCache;
  }

  const [movieGenres, tvGenres] = await Promise.all([
    tmdbClient.get('/genre/movie/list'),
    tmdbClient.get('/genre/tv/list')
  ]);

  const movieMap = {};
  const tvMap = {};

  movieGenres.data.genres.forEach((genre) => {
    movieMap[genre.id] = genre.name;
  });

  tvGenres.data.genres.forEach((genre) => {
    tvMap[genre.id] = genre.name;
  });

  genreCache = {
    movie: movieMap,
    tv: tvMap,
    loadedAt: Date.now()
  };

  return genreCache;
}

function toDbContent(item, type, genresMap) {
  const title = type === 'movie' ? item.title : item.name;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const year = date ? date.slice(0, 4) : null;
  const genreIds = item.genre_ids || [];

  const genre = genreIds
    .slice(0, 3)
    .map((genreId) => genresMap[genreId])
    .filter(Boolean)
    .join(', ') || 'Unknown';

  return {
    contentKey: `${type}-${item.id}`,
    tmdbId: Number(item.id),
    type,
    title: title || 'Untitled',
    posterUrl: item.poster_path ? `${IMAGE_BASE_POSTER}${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `${IMAGE_BASE_BACKDROP}${item.backdrop_path}` : '',
    overview: item.overview || 'No overview available.',
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : '0.0',
    releaseDate: date || null,
    releaseYear: year,
    genre,
    popularity: item.popularity ? Number(item.popularity) : 0
  };
}

function mapRowToCard(row) {
  return {
    id: row.content_key,
    tmdbId: row.tmdb_id,
    type: row.type,
    title: row.title,
    poster: row.poster_url,
    backdrop: row.backdrop_url,
    overview: row.overview,
    rating: Number(row.rating).toFixed(1),
    year: row.release_year || 'N/A',
    genre: row.genre || 'Unknown'
  };
}

function mapRowToDetails(row) {
  return {
    id: row.content_key,
    tmdbId: row.tmdb_id,
    type: row.type,
    title: row.title,
    poster: row.poster_url,
    backdrop: row.backdrop_url,
    overview: row.overview,
    rating: Number(row.rating).toFixed(1),
    releaseDate: row.release_date || 'Unknown',
    genre: row.genre || 'Unknown',
    videoSrc: ''
  };
}

async function initDbPool() {
  dbPool = new Pool(dbConfig);

  try {
    await dbPool.query('SELECT 1');
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.error('Database hostname could not be resolved. Check DB_HOST or DATABASE_URL.');
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('Database connection refused/timed out. Provider may block external connections or SSL may be required.');
    }

    throw error;
  }
}

async function bootstrapSchema() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS contents (
      id BIGSERIAL PRIMARY KEY,
      content_key VARCHAR(64) NOT NULL,
      tmdb_id BIGINT NOT NULL,
      type VARCHAR(16) NOT NULL CHECK (type IN ('movie', 'series')),
      title VARCHAR(255) NOT NULL,
      poster_url TEXT,
      backdrop_url TEXT,
      overview TEXT,
      rating DECIMAL(3,1) DEFAULT 0.0,
      release_date DATE NULL,
      release_year VARCHAR(4) NULL,
      genre VARCHAR(255) NULL,
      popularity DOUBLE DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbPool.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_key ON contents(content_key);');
  await dbPool.query('CREATE INDEX IF NOT EXISTS idx_type_rating ON contents(type, rating);');
  await dbPool.query('CREATE INDEX IF NOT EXISTS idx_title ON contents(title);');

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS content_collections (
      id BIGSERIAL PRIMARY KEY,
      collection_name VARCHAR(32) NOT NULL,
      content_key VARCHAR(64) NOT NULL,
      sort_rank INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbPool.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_content ON content_collections(collection_name, content_key);');
  await dbPool.query('CREATE INDEX IF NOT EXISTS idx_collection_rank ON content_collections(collection_name, sort_rank);');

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS content_videos (
      id BIGSERIAL PRIMARY KEY,
      content_key VARCHAR(64) NOT NULL,
      video_key VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      site VARCHAR(32) NOT NULL,
      video_type VARCHAR(64) NOT NULL,
      official BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMP NULL,
      embed_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbPool.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_video ON content_videos(content_key, video_key);');
  await dbPool.query('CREATE INDEX IF NOT EXISTS idx_content_video ON content_videos(content_key);');
}

async function upsertContents(contents) {
  if (!contents.length) {
    return;
  }

  const sql = `
    INSERT INTO contents (
      content_key, tmdb_id, type, title, poster_url, backdrop_url,
      overview, rating, release_date, release_year, genre, popularity
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (content_key) DO UPDATE SET
      tmdb_id = EXCLUDED.tmdb_id,
      type = EXCLUDED.type,
      title = EXCLUDED.title,
      poster_url = EXCLUDED.poster_url,
      backdrop_url = EXCLUDED.backdrop_url,
      overview = EXCLUDED.overview,
      rating = EXCLUDED.rating,
      release_date = EXCLUDED.release_date,
      release_year = EXCLUDED.release_year,
      genre = EXCLUDED.genre,
      popularity = EXCLUDED.popularity,
      updated_at = CURRENT_TIMESTAMP;
  `;

  for (const content of contents) {
    await dbPool.query(sql, [
      content.contentKey,
      content.tmdbId,
      content.type,
      content.title,
      content.posterUrl,
      content.backdropUrl,
      content.overview,
      content.rating,
      content.releaseDate,
      content.releaseYear,
      content.genre,
      content.popularity
    ]);
  }
}

async function replaceCollection(collectionName, contentKeys) {
  await dbPool.query('DELETE FROM content_collections WHERE collection_name = $1', [collectionName]);

  let rank = 1;
  for (const contentKey of contentKeys) {
    await dbPool.query(
      'INSERT INTO content_collections (collection_name, content_key, sort_rank) VALUES ($1, $2, $3)',
      [collectionName, contentKey, rank]
    );
    rank += 1;
  }
}

async function upsertTrailer(contentKey, trailer) {
  if (!trailer) {
    return;
  }

  await dbPool.query(
    `
    INSERT INTO content_videos (
      content_key, video_key, name, site, video_type, official, published_at, embed_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (content_key, video_key) DO UPDATE SET
      name = EXCLUDED.name,
      site = EXCLUDED.site,
      video_type = EXCLUDED.video_type,
      official = EXCLUDED.official,
      published_at = EXCLUDED.published_at,
      embed_url = EXCLUDED.embed_url;
    `,
    [
      contentKey,
      trailer.videoKey,
      trailer.name,
      trailer.site,
      trailer.videoType,
      trailer.official,
      trailer.publishedAt,
      trailer.embedUrl
    ]
  );
}

async function seedDatabaseFromTmdb() {
  const genres = await loadGenres();

  const [trendingResp, moviesResp, seriesResp] = await Promise.all([
    tmdbClient.get('/trending/all/week'),
    tmdbClient.get('/movie/popular', { params: { page: 1 } }),
    tmdbClient.get('/tv/popular', { params: { page: 1 } })
  ]);

  const trendingItems = (trendingResp.data.results || [])
    .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
    .slice(0, 20)
    .map((item) => {
      const type = item.media_type === 'movie' ? 'movie' : 'series';
      const mapKey = type === 'movie' ? 'movie' : 'tv';
      return toDbContent(item, type, genres[mapKey]);
    });

  const movieItems = (moviesResp.data.results || [])
    .filter((item) => item.poster_path)
    .slice(0, 40)
    .map((item) => toDbContent(item, 'movie', genres.movie));

  const seriesItems = (seriesResp.data.results || [])
    .filter((item) => item.poster_path)
    .slice(0, 40)
    .map((item) => toDbContent(item, 'series', genres.tv));

  const allItemsMap = new Map();
  [...trendingItems, ...movieItems, ...seriesItems].forEach((item) => {
    allItemsMap.set(item.contentKey, item);
  });

  const allItems = Array.from(allItemsMap.values());
  await upsertContents(allItems);

  await replaceCollection(COLLECTION_TRENDING, trendingItems.map((item) => item.contentKey));
  await replaceCollection(COLLECTION_MOVIES, movieItems.map((item) => item.contentKey));
  await replaceCollection(COLLECTION_SERIES, seriesItems.map((item) => item.contentKey));

  const trailerTargets = [...trendingItems, ...movieItems.slice(0, 10), ...seriesItems.slice(0, 10)];
  const visited = new Set();

  for (const item of trailerTargets) {
    if (visited.has(item.contentKey)) {
      continue;
    }
    visited.add(item.contentKey);

    try {
      const tmdbType = item.type === 'movie' ? 'movie' : 'tv';
      const videosResp = await tmdbClient.get(`/${tmdbType}/${item.tmdbId}/videos`);
      const trailer = pickTrailerVideo(videosResp.data.results || []);
      await upsertTrailer(item.contentKey, trailer);
    } catch (error) {
      console.warn(`Skipping trailer sync for ${item.contentKey}:`, error.response?.status || error.message);
    }
  }
}

async function ensureDatabaseReady() {
  await initDbPool();
  await bootstrapSchema();

  const { rows } = await dbPool.query('SELECT COUNT(*) AS total FROM contents');
  const total = Number(rows[0]?.total || 0);

  if (total === 0) {
    console.log('Database is empty. Seeding initial catalog from TMDB...');
    await seedDatabaseFromTmdb();
    console.log('Initial DB seed completed.');
  }
}

async function getCollection(collectionName, limit = 12, offset = 0) {
  const { rows } = await dbPool.query(
    `
    SELECT c.*
    FROM content_collections cc
    INNER JOIN contents c ON c.content_key = cc.content_key
    WHERE cc.collection_name = $1
    ORDER BY cc.sort_rank ASC
    LIMIT $2 OFFSET $3
    `,
    [collectionName, limit, offset]
  );

  return rows.map(mapRowToCard);
}

async function getCollectionCount(collectionName) {
  const { rows } = await dbPool.query(
    'SELECT COUNT(*) AS total FROM content_collections WHERE collection_name = $1',
    [collectionName]
  );

  return Number(rows[0]?.total || 0);
}

app.get('/api/health', async (_req, res) => {
  try {
    await dbPool.query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Database unreachable.' });
  }
});

app.get('/api/home', async (_req, res) => {
  try {
    const [trending, movies, series] = await Promise.all([
      getCollection(COLLECTION_TRENDING, 12, 0),
      getCollection(COLLECTION_MOVIES, 12, 0),
      getCollection(COLLECTION_SERIES, 12, 0)
    ]);

    return res.json({ trending, movies, series });
  } catch (error) {
    console.error('Error loading home content from DB:', error.message);
    return res.status(500).json({ message: 'Failed to load home content from database.' });
  }
});

app.get('/api/movies', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 24;
    const offset = (page - 1) * pageSize;

    const [results, total] = await Promise.all([
      getCollection(COLLECTION_MOVIES, pageSize, offset),
      getCollectionCount(COLLECTION_MOVIES)
    ]);

    return res.json({
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      results
    });
  } catch (error) {
    console.error('Error loading movies catalog from DB:', error.message);
    return res.status(500).json({ message: 'Failed to fetch movies catalog from database.' });
  }
});

app.get('/api/series', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = 24;
    const offset = (page - 1) * pageSize;

    const [results, total] = await Promise.all([
      getCollection(COLLECTION_SERIES, pageSize, offset),
      getCollectionCount(COLLECTION_SERIES)
    ]);

    return res.json({
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      results
    });
  } catch (error) {
    console.error('Error loading series catalog from DB:', error.message);
    return res.status(500).json({ message: 'Failed to fetch TV series catalog from database.' });
  }
});

app.get('/api/content/:id', async (req, res) => {
  try {
    const resolved = resolveContentId(req.params.id);

    if (!resolved) {
      return res.status(400).json({ message: 'Invalid content id format.' });
    }

    const { rows } = await dbPool.query('SELECT * FROM contents WHERE content_key = $1 LIMIT 1', [resolved.contentKey]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Content not found in database.' });
    }

    return res.json(mapRowToDetails(rows[0]));
  } catch (error) {
    console.error('Error loading content details from DB:', error.message);
    return res.status(500).json({ message: 'Failed to fetch content details from database.' });
  }
});

app.get('/api/content/:id/videos', async (req, res) => {
  try {
    const resolved = resolveContentId(req.params.id);

    if (!resolved) {
      return res.status(400).json({ message: 'Invalid content id format.' });
    }

    const { rows } = await dbPool.query(
      `
      SELECT *
      FROM content_videos
      WHERE content_key = $1
      ORDER BY official DESC, published_at DESC, created_at DESC
      LIMIT 1
      `,
      [resolved.contentKey]
    );

    if (!rows.length) {
      return res.json({ trailer: null });
    }

    const row = rows[0];
    return res.json({
      trailer: {
        key: row.video_key,
        name: row.name,
        site: row.site,
        type: row.video_type,
        official: Boolean(row.official),
        publishedAt: row.published_at,
        embedUrl: row.embed_url
      }
    });
  } catch (error) {
    console.error('Error loading content video from DB:', error.message);
    return res.status(500).json({ message: 'Failed to fetch content videos from database.' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();

    if (!query) {
      return res.status(400).json({ message: 'Query parameter q is required.' });
    }

    const { rows } = await dbPool.query(
      `
      SELECT *
      FROM contents
      WHERE title ILIKE $1
      ORDER BY popularity DESC, rating DESC
      LIMIT 30
      `,
      [`%${query}%`]
    );

    return res.json(rows.map(mapRowToCard));
  } catch (error) {
    console.error('Error searching content from DB:', error.message);
    return res.status(500).json({ message: 'Failed to search content from database.' });
  }
});

app.get('/api/admin/content', requireAdminToken, async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));

    let rows;

    if (type) {
      const result = await dbPool.query(
        `
        SELECT c.*
        FROM contents c
        WHERE c.type = $1
        ORDER BY c.updated_at DESC
        LIMIT $2
        `,
        [type, limit]
      );
      rows = result.rows;
    } else {
      const result = await dbPool.query(
        `
        SELECT c.*
        FROM contents c
        ORDER BY c.updated_at DESC
        LIMIT $1
        `,
        [limit]
      );
      rows = result.rows;
    }

    return res.json(rows.map(mapRowToCard));
  } catch (error) {
    console.error('Error listing admin content:', error.message);
    return res.status(500).json({ message: 'Failed to list content.' });
  }
});

app.post('/api/admin/content', requireAdminToken, async (req, res) => {
  try {
    const type = normalizeType(req.body.type);
    const tmdbId = Number(req.body.tmdbId);
    const title = String(req.body.title || '').trim();

    if (!type) {
      return res.status(400).json({ message: 'type must be movie or series.' });
    }

    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ message: 'tmdbId must be a positive number.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }

    const contentKey = `${type}-${tmdbId}`;
    const rating = Number(req.body.rating || 0);
    const releaseDate = req.body.releaseDate ? String(req.body.releaseDate) : null;
    const releaseYear = releaseDate ? releaseDate.slice(0, 4) : String(req.body.year || '').slice(0, 4) || null;
    const collections = normalizeCollections(type, req.body.collections);
    const trailerKey = String(req.body.trailerKey || '').trim();
    const trailerName = String(req.body.trailerName || 'Official Trailer').trim();

    await dbPool.query(
      `
      INSERT INTO contents (
        content_key, tmdb_id, type, title, poster_url, backdrop_url,
        overview, rating, release_date, release_year, genre, popularity, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      ON CONFLICT (content_key) DO UPDATE SET
        title = EXCLUDED.title,
        poster_url = EXCLUDED.poster_url,
        backdrop_url = EXCLUDED.backdrop_url,
        overview = EXCLUDED.overview,
        rating = EXCLUDED.rating,
        release_date = EXCLUDED.release_date,
        release_year = EXCLUDED.release_year,
        genre = EXCLUDED.genre,
        popularity = EXCLUDED.popularity,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        contentKey,
        tmdbId,
        type,
        title,
        String(req.body.poster || '').trim(),
        String(req.body.backdrop || '').trim(),
        String(req.body.overview || '').trim(),
        Number.isFinite(rating) ? rating : 0,
        releaseDate,
        releaseYear,
        String(req.body.genre || '').trim(),
        Number(req.body.popularity || 0)
      ]
    );

    await removeContentFromCollections(contentKey);

    for (const collectionName of collections) {
      await addContentToCollection(collectionName, contentKey);
    }

    if (trailerKey) {
      await dbPool.query(
        `
        INSERT INTO content_videos (
          content_key, video_key, name, site, video_type, official, published_at, embed_url
        ) VALUES ($1, $2, $3, 'YouTube', 'Trailer', TRUE, NOW(), $4)
        ON CONFLICT (content_key, video_key) DO UPDATE SET
          name = EXCLUDED.name,
          embed_url = EXCLUDED.embed_url
        `,
        [contentKey, trailerKey, trailerName, `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`]
      );
    }

    return res.json({ message: 'Content saved successfully.', id: contentKey });
  } catch (error) {
    console.error('Error saving admin content:', error.message);
    return res.status(500).json({ message: 'Failed to save content.' });
  }
});

app.delete('/api/admin/content/:id', requireAdminToken, async (req, res) => {
  try {
    const resolved = resolveContentId(req.params.id);

    if (!resolved) {
      return res.status(400).json({ message: 'Invalid content id format.' });
    }

    await dbPool.query('DELETE FROM content_videos WHERE content_key = $1', [resolved.contentKey]);
    await dbPool.query('DELETE FROM content_collections WHERE content_key = $1', [resolved.contentKey]);
    const result = await dbPool.query('DELETE FROM contents WHERE content_key = $1', [resolved.contentKey]);

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Content not found.' });
    }

    return res.json({ message: 'Content deleted successfully.' });
  } catch (error) {
    console.error('Error deleting admin content:', error.message);
    return res.status(500).json({ message: 'Failed to delete content.' });
  }
});

app.post('/api/admin/sync', requireAdminToken, async (_req, res) => {
  try {
    await seedDatabaseFromTmdb();
    return res.json({ message: 'Database sync completed.' });
  } catch (error) {
    console.error('Error syncing database:', error.message);
    return res.status(500).json({ message: 'Database sync failed.' });
  }
});

async function main() {
  await ensureDatabaseReady();

  if (process.argv.includes('--bootstrap-only')) {
    console.log('Database bootstrap completed. Exiting as requested.');
    await dbPool.end();
    process.exit(0);
  }

  app.listen(port, () => {
    console.log(`Movie backend running on port ${port}`);
  });
}

main().catch(async (error) => {
  console.error('Fatal startup error:', error.message);

  if (dbPool) {
    await dbPool.end();
  }

  process.exit(1);
});
