import React from 'react';
import { Link } from 'react-router-dom';

const HeroSection = ({ movie }) => {
  if (!movie) return null;

  return (
    <div className="hero">
      <div
        className="hero-backdrop"
        style={{ backgroundImage: `url(${movie.backdrop || movie.poster})` }}
      />
      <div className="hero-content">
        <div className="hero-badge">🔥 Featured</div>
        <h1 className="hero-title">{movie.title}</h1>
        <div className="hero-meta">
          <span className="hero-rating">⭐ {movie.rating}</span>
          <span>{movie.year}</span>
          <span>{movie.genre}</span>
        </div>
        <p className="hero-overview">{movie.overview}</p>
        <div className="hero-actions">
          <Link to={`/movie/${movie.id}`} className="btn-watch">▶ Watch Now</Link>
          <Link to={`/movie/${movie.id}`} className="btn-info">ℹ More Info</Link>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
