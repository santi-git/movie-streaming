import React from 'react';

const VideoPlayer = ({ videoSrc, youtubeKey, title = 'Trailer' }) => {
  if (youtubeKey) {
    return (
      <div className="video-player">
        <iframe
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  if (videoSrc) {
    return (
      <div className="video-player">
        <video controls>
          <source src={videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return (
    <div className="video-player video-player-empty">
      <p>No playable video is available yet for this title.</p>
    </div>
  );
};

export default VideoPlayer;