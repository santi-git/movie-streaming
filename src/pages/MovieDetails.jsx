import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { fetchMovieDetails, fetchContentVideos } from '../services/api';

const MovieDetails = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadMovieDetails = async () => {
      try {
        setLoading(true);
        const [details, videos] = await Promise.all([
          fetchMovieDetails(id),
          fetchContentVideos(id)
        ]);

        if (!mounted) {
          return;
        }

        setMovie(details);
        setTrailer(videos?.trailer || null);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err?.response?.data?.message || 'Failed to load movie details.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMovieDetails();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return <div className="page-content loading-screen">Loading movie details...</div>;
  }

  if (error) {
    return <div className="page-content error-screen">Error: {error}</div>;
  }

  if (!movie) {
    return <div className="page-content error-screen">Movie not found.</div>;
  }

  return (
    <div className="movie-details-page">
      <div className="movie-details-poster">
        <img
          src={movie.poster}
          alt={movie.title}
          onError={(e) => {
            e.target.src = 'https://placehold.co/320x480/1c1c1c/666?text=No+Image';
          }}
        />
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
        <VideoPlayer youtubeKey={trailer?.key} videoSrc={movie.videoSrc} title={trailer?.name || movie.title} />
      </div>
    </div>
  );
};

export default MovieDetails;