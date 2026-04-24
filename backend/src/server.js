const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5001);
const tmdbReadToken = process.env.TMDB_READ_TOKEN;

if (!tmdbReadToken) {
  console.error('Missing TMDB_READ_TOKEN in backend environment variables.');
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

const hasDbConfig = Boolean(
  dbConfig.host &&
  dbConfig.user &&
  dbConfig.password &&
  dbConfig.database
);

if (!hasDbConfig) {
  console.error('Missing DB configuration. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
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
  dbPool = mysql.createPool(dbConfig);
  const connection = await dbPool.getConnection();
  connection.release();
}

async function bootstrapSchema() {
  await dbPool.execute(`
    CREATE TABLE IF NOT EXISTS contents (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      content_key VARCHAR(64) NOT NULL,
      tmdb_id BIGINT UNSIGNED NOT NULL,
      type ENUM('movie', 'series') NOT NULL,
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_content_key (content_key),
      KEY idx_type_rating (type, rating),
      KEY idx_title (title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await dbPool.execute(`
    CREATE TABLE IF NOT EXISTS content_collections (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      collection_name VARCHAR(32) NOT NULL,
      content_key VARCHAR(64) NOT NULL,
      sort_rank INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_collection_content (collection_name, content_key),
      KEY idx_collection_rank (collection_name, sort_rank)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await dbPool.execute(`
    CREATE TABLE IF NOT EXISTS content_videos (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      content_key VARCHAR(64) NOT NULL,
      video_key VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      site VARCHAR(32) NOT NULL,
      video_type VARCHAR(64) NOT NULL,
      official TINYINT(1) DEFAULT 0,
      published_at DATETIME NULL,
      embed_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_content_video (content_key, video_key),
      KEY idx_content_video (content_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function upsertContents(contents) {
  if (!contents.length) {
    return;
  }

  const sql = `
    INSERT INTO contents (
      content_key, tmdb_id, type, title, poster_url, backdrop_url,
      overview, rating, release_date, release_year, genre, popularity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      tmdb_id = VALUES(tmdb_id),
      type = VALUES(type),
      title = VALUES(title),
      poster_url = VALUES(poster_url),
      backdrop_url = VALUES(backdrop_url),
      overview = VALUES(overview),
      rating = VALUES(rating),
      release_date = VALUES(release_date),
      release_year = VALUES(release_year),
      genre = VALUES(genre),
      popularity = VALUES(popularity),
      updated_at = CURRENT_TIMESTAMP;
  `;

  for (const content of contents) {
    await dbPool.execute(sql, [
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
  await dbPool.execute('DELETE FROM content_collections WHERE collection_name = ?', [collectionName]);

  let rank = 1;
  for (const contentKey of contentKeys) {
    await dbPool.execute(
      'INSERT INTO content_collections (collection_name, content_key, sort_rank) VALUES (?, ?, ?)',
      [collectionName, contentKey, rank]
    );
    rank += 1;
  }
}

async function upsertTrailer(contentKey, trailer) {
  if (!trailer) {
    return;
  }

  await dbPool.execute(
    `
    INSERT INTO content_videos (
      content_key, video_key, name, site, video_type, official, published_at, embed_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      site = VALUES(site),
      video_type = VALUES(video_type),
      official = VALUES(official),
      published_at = VALUES(published_at),
      embed_url = VALUES(embed_url);
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

  const [rows] = await dbPool.execute('SELECT COUNT(*) AS total FROM contents');
  const total = Number(rows[0].total || 0);

  if (total === 0) {
    console.log('Database is empty. Seeding initial catalog from TMDB...');
    await seedDatabaseFromTmdb();
    console.log('Initial DB seed completed.');
  }
}

async function getCollection(collectionName, limit = 12, offset = 0) {
  const [rows] = await dbPool.execute(
    `
    SELECT c.*
    FROM content_collections cc
    INNER JOIN contents c ON c.content_key = cc.content_key
    WHERE cc.collection_name = ?
    ORDER BY cc.sort_rank ASC
    LIMIT ? OFFSET ?
    `,
    [collectionName, limit, offset]
  );

  return rows.map(mapRowToCard);
}

async function getCollectionCount(collectionName) {
  const [rows] = await dbPool.execute(
    'SELECT COUNT(*) AS total FROM content_collections WHERE collection_name = ?',
    [collectionName]
  );

  return Number(rows[0].total || 0);
}

app.get('/api/health', async (_req, res) => {
  try {
    await dbPool.execute('SELECT 1');
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

    const [rows] = await dbPool.execute('SELECT * FROM contents WHERE content_key = ? LIMIT 1', [resolved.contentKey]);

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

    const [rows] = await dbPool.execute(
      `
      SELECT *
      FROM content_videos
      WHERE content_key = ?
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

    const [rows] = await dbPool.execute(
      `
      SELECT *
      FROM contents
      WHERE title LIKE ?
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

app.post('/api/admin/sync', async (_req, res) => {
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
