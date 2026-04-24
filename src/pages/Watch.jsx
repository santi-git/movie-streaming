import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { fetchMovieDetails, fetchContentVideos } from '../services/api';

const Watch = () => {
  const { id } = useParams();
  const [content, setContent] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadWatchData = async () => {
      try {
        setLoading(true);

        const details = await fetchMovieDetails(id);
        let videos = null;

        try {
          videos = await fetchContentVideos(id);
        } catch (_videoError) {
          // Keep watch page available even if trailer endpoint has not been deployed yet.
          videos = { trailer: null };
        }

        if (!mounted) {
          return;
        }

        setContent(details);
        setTrailer(videos?.trailer || null);
        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err?.response?.data?.message || 'Failed to load video.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadWatchData();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page-content loading-screen">
        <div className="loading-spinner" />
        Preparing player...
      </div>
    );
  }

  if (error) {
    return <div className="page-content error-screen">Error: {error}</div>;
  }

  return (
    <div className="page-content watch-page">
      <div className="watch-header">
        <h1>{content?.title || 'Now Playing'}</h1>
        <Link to={`/movie/${id}`} className="btn-info">Back to Details</Link>
      </div>

      <VideoPlayer youtubeKey={trailer?.key} title={trailer?.name || content?.title} />

      <p className="watch-note">
        Playback is trailer-based from official TMDB/YouTube sources. For full movie streaming in production,
        integrate licensed providers and DRM-enabled delivery.
      </p>
    </div>
  );
};

export default Watch;
