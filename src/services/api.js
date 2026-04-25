import axios from 'axios';

// Base URL for the movie API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
const apiClient = axios.create({
  baseURL: API_BASE_URL
});

const withAdminHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`
  }
});

export const fetchHomeContent = async () => {
  const response = await apiClient.get('/home');
  return response.data;
};

export const fetchCatalog = async (type, page = 1) => {
  const endpoint = type === 'series' ? '/series' : '/movies';
  const response = await apiClient.get(endpoint, { params: { page } });
  return response.data;
};

// Function to fetch a list of movies
export const fetchMovies = async () => {
  try {
    const response = await apiClient.get('/home');
    return response.data.movies || [];
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
};

// Function to fetch details of a specific movie by ID
export const fetchMovieDetails = async (movieId) => {
  try {
    const response = await apiClient.get(`/content/${movieId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for movie ID ${movieId}:`, error);
    throw error;
  }
};

export const fetchContentVideos = async (contentId) => {
  try {
    const response = await apiClient.get(`/content/${contentId}/videos`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching videos for content ID ${contentId}:`, error);
    throw error;
  }
};

// Function to search for movies by title
export const searchMovies = async (query) => {
  try {
    const response = await apiClient.get('/search', {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching for movies:', error);
    throw error;
  }
};

export const adminListContent = async (token, type = '') => {
  const response = await apiClient.get('/admin/content', {
    ...withAdminHeaders(token),
    params: type ? { type } : undefined
  });
  return response.data;
};

export const adminSaveContent = async (token, payload) => {
  const response = await apiClient.post('/admin/content', payload, withAdminHeaders(token));
  return response.data;
};

export const adminDeleteContent = async (token, contentId) => {
  const response = await apiClient.delete(`/admin/content/${contentId}`, withAdminHeaders(token));
  return response.data;
};

export const adminSyncDatabase = async (token) => {
  const response = await apiClient.post('/admin/sync', {}, withAdminHeaders(token));
  return response.data;
};