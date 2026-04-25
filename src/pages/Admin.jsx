import React, { useEffect, useMemo, useState } from 'react';
import {
  adminDeleteContent,
  adminListContent,
  adminSaveContent,
  adminSyncDatabase
} from '../services/api';

const ADMIN_TOKEN_STORAGE_KEY = 'movie_stream_admin_token';

const Admin = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [adminToken, setAdminToken] = useState(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    type: 'movie',
    tmdbId: '',
    title: '',
    poster: '',
    backdrop: '',
    overview: '',
    rating: '',
    releaseDate: '',
    genre: '',
    popularity: '',
    trailerKey: '',
    trailerName: '',
    includeMovies: true,
    includeSeries: false,
    includeTrending: true
  });

  const canUseAdmin = Boolean(adminToken);

  const collections = useMemo(() => {
    const selected = [];

    if (form.includeMovies) {
      selected.push('movies');
    }

    if (form.includeSeries) {
      selected.push('series');
    }

    if (form.includeTrending) {
      selected.push('trending');
    }

    return selected;
  }, [form.includeMovies, form.includeSeries, form.includeTrending]);

  const refreshList = async () => {
    if (!adminToken) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await adminListContent(adminToken, typeFilter);
      setItems(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load admin content list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, [adminToken, typeFilter]);

  const handleSaveToken = () => {
    const token = tokenInput.trim();

    if (!token) {
      setError('Please provide a valid admin token.');
      return;
    }

    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    setAdminToken(token);
    setTokenInput('');
    setError('');
    setMessage('Admin token saved.');
  };

  const handleClearToken = () => {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken('');
    setItems([]);
    setMessage('Admin token cleared.');
    setError('');
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!adminToken) {
      setError('Set admin token first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await adminSaveContent(adminToken, {
        type: form.type,
        tmdbId: Number(form.tmdbId),
        title: form.title,
        poster: form.poster,
        backdrop: form.backdrop,
        overview: form.overview,
        rating: form.rating ? Number(form.rating) : 0,
        releaseDate: form.releaseDate || null,
        genre: form.genre,
        popularity: form.popularity ? Number(form.popularity) : 0,
        trailerKey: form.trailerKey,
        trailerName: form.trailerName,
        collections
      });

      setMessage('Content saved successfully.');
      await refreshList();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save content.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contentId) => {
    if (!adminToken) {
      setError('Set admin token first.');
      return;
    }

    if (!window.confirm(`Delete ${contentId}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await adminDeleteContent(adminToken, contentId);
      setMessage('Content deleted successfully.');
      await refreshList();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete content.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!adminToken) {
      setError('Set admin token first.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await adminSyncDatabase(adminToken);
      setMessage(data?.message || 'Sync completed.');
      await refreshList();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to sync content.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content admin-page">
      <div className="admin-grid">
        <section className="admin-card">
          <h1>Admin Portal</h1>
          <p className="admin-help">Upload or update movies/series directly in your production database.</p>

          <div className="admin-token-row">
            <input
              type="password"
              placeholder="Paste ADMIN_SYNC_TOKEN"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
            />
            <button type="button" onClick={handleSaveToken}>Save Token</button>
            <button type="button" className="btn-info" onClick={handleClearToken}>Clear</button>
          </div>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <label>
                Type
                <select value={form.type} onChange={(event) => handleChange('type', event.target.value)}>
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </select>
              </label>
              <label>
                TMDB ID
                <input
                  type="number"
                  value={form.tmdbId}
                  onChange={(event) => handleChange('tmdbId', event.target.value)}
                  required
                />
              </label>
              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => handleChange('title', event.target.value)}
                  required
                />
              </label>
              <label>
                Release Date
                <input
                  type="date"
                  value={form.releaseDate}
                  onChange={(event) => handleChange('releaseDate', event.target.value)}
                />
              </label>
              <label>
                Rating
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.rating}
                  onChange={(event) => handleChange('rating', event.target.value)}
                />
              </label>
              <label>
                Popularity
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.popularity}
                  onChange={(event) => handleChange('popularity', event.target.value)}
                />
              </label>
            </div>

            <label>
              Genre
              <input
                type="text"
                value={form.genre}
                onChange={(event) => handleChange('genre', event.target.value)}
                placeholder="Action, Adventure"
              />
            </label>

            <label>
              Poster URL
              <input
                type="text"
                value={form.poster}
                onChange={(event) => handleChange('poster', event.target.value)}
              />
            </label>

            <label>
              Backdrop URL
              <input
                type="text"
                value={form.backdrop}
                onChange={(event) => handleChange('backdrop', event.target.value)}
              />
            </label>

            <label>
              Overview
              <textarea
                rows={5}
                value={form.overview}
                onChange={(event) => handleChange('overview', event.target.value)}
              />
            </label>

            <div className="admin-form-grid">
              <label>
                Trailer YouTube Key
                <input
                  type="text"
                  value={form.trailerKey}
                  onChange={(event) => handleChange('trailerKey', event.target.value)}
                />
              </label>
              <label>
                Trailer Name
                <input
                  type="text"
                  value={form.trailerName}
                  onChange={(event) => handleChange('trailerName', event.target.value)}
                />
              </label>
            </div>

            <div className="admin-checkbox-row">
              <label><input type="checkbox" checked={form.includeMovies} onChange={(event) => handleChange('includeMovies', event.target.checked)} /> Movies</label>
              <label><input type="checkbox" checked={form.includeSeries} onChange={(event) => handleChange('includeSeries', event.target.checked)} /> Series</label>
              <label><input type="checkbox" checked={form.includeTrending} onChange={(event) => handleChange('includeTrending', event.target.checked)} /> Trending</label>
            </div>

            <div className="admin-actions">
              <button type="submit" disabled={!canUseAdmin || loading}>Save Content</button>
              <button type="button" className="btn-info" onClick={handleSync} disabled={!canUseAdmin || loading}>Sync From TMDB</button>
            </div>
          </form>

          {message ? <p className="admin-message success">{message}</p> : null}
          {error ? <p className="admin-message error">{error}</p> : null}
        </section>

        <section className="admin-card">
          <div className="admin-list-header">
            <h2>Existing Content</h2>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All</option>
              <option value="movie">Movies</option>
              <option value="series">Series</option>
            </select>
          </div>

          <div className="admin-list">
            {items.map((item) => (
              <div key={item.id} className="admin-list-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.id}</p>
                </div>
                <button type="button" onClick={() => handleDelete(item.id)} disabled={!canUseAdmin || loading}>Delete</button>
              </div>
            ))}
            {!items.length && !loading ? <p className="admin-help">No content found.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Admin;
