import React from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';

const MovieRow = ({ title, movies = [], viewAllPath }) => {
  return (
    <section className="movie-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {viewAllPath ? (
          <Link to={viewAllPath} className="section-view-all">View All</Link>
        ) : null}
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
