import { useState, useEffect } from 'react';
import { fetchHomeContent } from '../services/api';

const useMovies = () => {
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadHomeContent = async () => {
      try {
        setLoading(true);
        const data = await fetchHomeContent();

        if (!mounted) {
          return;
        }

        setMovies(data.movies || []);
        setSeries(data.series || []);
        setTrending(data.trending || []);
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

    loadHomeContent();

    return () => {
      mounted = false;
    };
  }, []);

  return { movies, series, trending, loading, error };
};

export default useMovies;
