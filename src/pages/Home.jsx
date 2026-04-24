import React from 'react';
import HeroSection from '../components/HeroSection';
import MovieRow from '../components/MovieRow';
import useMovies from '../hooks/useMovies';

const Home = () => {
  const { movies, series, trending, loading, error } = useMovies();

  if (loading) {
    return (
      <div className="page-content loading-screen">
        <div className="loading-spinner" />
        Loading...
      </div>
    );
  }

  if (error) {
    return <div className="page-content error-screen">Error: {error}</div>;
  }

  return (
    <div className="page-content">
      <HeroSection movie={trending[0]} />
      <MovieRow title="Trending Movies" movies={trending} viewAllPath="/movies" />
      <MovieRow title="Movies" movies={movies} viewAllPath="/movies" />
      <MovieRow title="TV Series" movies={series} viewAllPath="/tv-shows" />
    </div>
  );
};

export default Home;