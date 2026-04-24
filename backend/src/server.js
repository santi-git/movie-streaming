const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;
const tmdbReadToken = process.env.TMDB_READ_TOKEN;

if (!tmdbReadToken) {
  // Fail fast to avoid running a broken API service without credentials.
  console.error('Missing TMDB_READ_TOKEN in backend environment variables.');
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

let genreCache = {
  movie: {},
  tv: {},
  loadedAt: 0
};

const CACHE_TTL_MS = 1000 * 60 * 60;

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

function toCardItem(item, type, genresMap) {
  const title = type === 'movie' ? item.title : item.name;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const year = date ? date.slice(0, 4) : 'N/A';

  const genreIds = item.genre_ids || [];
  const genre = genreIds
    .slice(0, 2)
    .map((genreId) => genresMap[genreId])
    .filter(Boolean)
    .join(', ') || 'Unknown';

  return {
    id: `${type}-${item.id}`,
    tmdbId: item.id,
    type,
    title,
    poster: item.poster_path ? `${IMAGE_BASE_POSTER}${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMAGE_BASE_BACKDROP}${item.backdrop_path}` : '',
    overview: item.overview || 'No overview available.',
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : 'N/A',
    year,
    genre
  };
}

function toDetailsItem(item, type) {
  const title = type === 'movie' ? item.title : item.name;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const genres = (item.genres || []).map((genre) => genre.name).join(', ') || 'Unknown';

  return {
    id: `${type}-${item.id}`,
    tmdbId: item.id,
    type,
    title,
    poster: item.poster_path ? `${IMAGE_BASE_POSTER}${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMAGE_BASE_BACKDROP}${item.backdrop_path}` : '',
    overview: item.overview || 'No overview available.',
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : 'N/A',
    releaseDate: date || 'Unknown',
    genre: genres,
    videoSrc: ''
  };
}

function resolveContentId(contentId) {
  const [type, tmdbId] = String(contentId || '').split('-');

  if (!type || !tmdbId || !['movie', 'series', 'tv'].includes(type)) {
    return null;
  }

  return {
    tmdbType: type === 'movie' ? 'movie' : 'tv',
    appType: type === 'movie' ? 'movie' : 'series',
    tmdbId
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
    id: trailer.id,
    key: trailer.key,
    name: trailer.name,
    site: trailer.site,
    type: trailer.type,
    official: Boolean(trailer.official),
    publishedAt: trailer.published_at || null,
    embedUrl: `https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/home', async (_req, res) => {
  try {
    const genres = await loadGenres();

    const [trendingResp, moviesResp, tvResp] = await Promise.all([
      tmdbClient.get('/trending/all/week'),
      tmdbClient.get('/movie/popular'),
      tmdbClient.get('/tv/popular')
    ]);

    const trending = (trendingResp.data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => {
        const type = item.media_type === 'movie' ? 'movie' : 'series';
        const mapKey = type === 'movie' ? 'movie' : 'tv';
        return toCardItem(item, type, genres[mapKey]);
      })
      .filter((item) => item.poster)
      .slice(0, 12);

    const movies = (moviesResp.data.results || [])
      .map((item) => toCardItem(item, 'movie', genres.movie))
      .filter((item) => item.poster)
      .slice(0, 12);

    const series = (tvResp.data.results || [])
      .map((item) => toCardItem(item, 'series', genres.tv))
      .filter((item) => item.poster)
      .slice(0, 12);

    res.json({ trending, movies, series });
  } catch (error) {
    console.error('Error loading home content:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch home content from TMDB.' });
  }
});

app.get('/api/movies', async (req, res) => {
  try {
    const genres = await loadGenres();
    const page = Number(req.query.page || 1);
    const moviesResp = await tmdbClient.get('/movie/popular', { params: { page } });

    const movies = (moviesResp.data.results || [])
      .map((item) => toCardItem(item, 'movie', genres.movie))
      .filter((item) => item.poster);

    return res.json({
      page: moviesResp.data.page,
      totalPages: moviesResp.data.total_pages,
      results: movies
    });
  } catch (error) {
    console.error('Error loading movies catalog:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to fetch movies catalog from TMDB.' });
  }
});

app.get('/api/series', async (req, res) => {
  try {
    const genres = await loadGenres();
    const page = Number(req.query.page || 1);
    const tvResp = await tmdbClient.get('/tv/popular', { params: { page } });

    const series = (tvResp.data.results || [])
      .map((item) => toCardItem(item, 'series', genres.tv))
      .filter((item) => item.poster);

    return res.json({
      page: tvResp.data.page,
      totalPages: tvResp.data.total_pages,
      results: series
    });
  } catch (error) {
    console.error('Error loading tv catalog:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to fetch TV series catalog from TMDB.' });
  }
});

app.get('/api/content/:id', async (req, res) => {
  try {
    const resolved = resolveContentId(req.params.id);

    if (!resolved) {
      return res.status(400).json({ message: 'Invalid content id format.' });
    }

    const detailsResp = await tmdbClient.get(`/${resolved.tmdbType}/${resolved.tmdbId}`);

    return res.json(toDetailsItem(detailsResp.data, resolved.appType));
  } catch (error) {
    console.error('Error loading content details:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to fetch content details from TMDB.' });
  }
});

app.get('/api/content/:id/videos', async (req, res) => {
  try {
    const resolved = resolveContentId(req.params.id);

    if (!resolved) {
      return res.status(400).json({ message: 'Invalid content id format.' });
    }

    const videosResp = await tmdbClient.get(`/${resolved.tmdbType}/${resolved.tmdbId}/videos`);
    const trailer = pickTrailerVideo(videosResp.data.results || []);

    return res.json({ trailer });
  } catch (error) {
    console.error('Error loading content videos:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to fetch content videos from TMDB.' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || !String(query).trim()) {
      return res.status(400).json({ message: 'Query parameter q is required.' });
    }

    const genres = await loadGenres();
    const searchResp = await tmdbClient.get('/search/multi', {
      params: {
        query: String(query).trim(),
        include_adult: false
      }
    });

    const results = (searchResp.data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => {
        const type = item.media_type === 'movie' ? 'movie' : 'series';
        const mapKey = type === 'movie' ? 'movie' : 'tv';
        return toCardItem(item, type, genres[mapKey]);
      })
      .filter((item) => item.poster)
      .slice(0, 20);

    return res.json(results);
  } catch (error) {
    console.error('Error searching content:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to search TMDB content.' });
  }
});

app.listen(port, () => {
  console.log(`Movie backend running on port ${port}`);
});
