import React from 'react';
import { useParams, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';

const MovieDetails = () => {
  const { id } = useParams();

  // Mock data — replace with API call using `id`
  const movie = {
    title: 'The Dark Knight',
    poster: 'https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    overview: 'When the menace known as the Joker wreaks havoc on Gotham City, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    releaseDate: '2008-07-18',
    rating: '9.0',
    genre: 'Action, Crime, Drama',
    videoSrc: '',
  };

  return (
    <div className="movie-details-page">
      <div className="movie-details-poster">
        <img src={movie.poster} alt={movie.title} />
      </div>
      <div className="movie-details-info">
        <h1>{movie.title}</h1>
        <div className="movie-details-meta">
          <span className="star">⭐ {movie.rating}</span>
          <span>{movie.releaseDate}</span>
          <span>{movie.genre}</span>
        </div>
        <p className="movie-details-overview">{movie.overview}</p>
        <Link to={`/watch/${id}`} className="btn-watch">▶ Watch Now</Link>
        <VideoPlayer videoSrc={movie.videoSrc} />
      </div>
    </div>
  );
};

export default MovieDetails;