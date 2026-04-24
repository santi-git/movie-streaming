import React from 'react';
import { Link } from 'react-router-dom';

const MovieCard = ({ movie }) => {
  const { id, title, poster, rating, year, genre } = movie;

  return (
    <Link to={`/movie/${id}`} className="movie-card">
      <div className="movie-card-poster">
        <img
          src={poster}
          alt={title}
          onError={(e) => {
            e.target.src = 'https://placehold.co/175x262/1c1c1c/666?text=No+Image';
          }}
        />
        <div className="movie-card-rating">⭐ {rating}</div>
        <div className="movie-card-play-overlay">
          <div className="play-icon">▶</div>
        </div>
      </div>
      <div className="movie-card-info">
        <div className="movie-card-title">{title}</div>
        <div className="movie-card-meta">{year}</div>
        <div className="movie-card-genre">{genre}</div>
      </div>
    </Link>
  );
};

export default MovieCard;