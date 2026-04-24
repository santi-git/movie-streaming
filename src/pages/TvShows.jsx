import React, { useEffect, useState } from 'react';
import MovieList from '../components/MovieList';
import { fetchCatalog } from '../services/api';

const TvShows = () => {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadSeries = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalog('series');

        if (!mounted) {
          return;
        }

        setSeries(data.results || []);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err?.response?.data?.message || 'Failed to load TV series.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSeries();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="page-content loading-screen">
        <div className="loading-spinner" />
        Loading TV series...
      </div>
    );
  }

  if (error) {
    return <div className="page-content error-screen">Error: {error}</div>;
  }

  return (
    <div className="page-content catalog-page">
      <div className="catalog-header">
        <h1>Popular TV Series</h1>
        <p>Live data from TMDB.</p>
      </div>
      <MovieList movies={series} />
    </div>
  );
};

export default TvShows;
