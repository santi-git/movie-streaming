import React from 'react';
import MovieCard from './MovieCard';

const MovieRow = ({ title, movies = [] }) => {
  return (
    <section className="movie-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <a href="#" className="section-view-all">View All</a>
      </div>
      <div className="movie-scroll-row">
        {movies.map(movie => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
};

export default MovieRow;
