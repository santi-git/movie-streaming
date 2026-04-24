import React, { useEffect, useState } from 'react';
import MovieList from '../components/MovieList';
import { fetchCatalog } from '../services/api';

const Movies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadMovies = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalog('movies');

        if (!mounted) {
          return;
        }

        setMovies(data.results || []);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err?.response?.data?.message || 'Failed to load movies.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMovies();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="page-content loading-screen">
        <div className="loading-spinner" />
        Loading movies...
      </div>
    );
  }

  if (error) {
    return <div className="page-content error-screen">Error: {error}</div>;
  }

  return (
    <div className="page-content catalog-page">
      <div className="catalog-header">
        <h1>Popular Movies</h1>
        <p>Live data from TMDB.</p>
      </div>
      <MovieList movies={movies} />
    </div>
  );
};

export default Movies;
