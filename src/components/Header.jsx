import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMovies = location.pathname.startsWith('/movies') ||
    (location.pathname.startsWith('/movie/') && location.pathname.includes('movie-'));
  const isTvShows = location.pathname.startsWith('/tv-shows') ||
    (location.pathname.startsWith('/movie/') && location.pathname.includes('series-'));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <Link to="/" className="navbar-logo">
        Movie<span>Stream</span>
      </Link>

      <ul className="navbar-links">
        <li><Link to="/" className={isHome ? 'active' : ''}>Home</Link></li>
        <li><Link to="/movies" className={isMovies ? 'active' : ''}>Movies</Link></li>
        <li><Link to="/tv-shows" className={isTvShows ? 'active' : ''}>TV Shows</Link></li>
      </ul>

      <div className="navbar-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search movies, series..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
    </nav>
  );
};

export default Header;