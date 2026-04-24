import axios from 'axios';

// Base URL for the movie API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Function to fetch a list of movies
export const fetchMovies = async () => {
  
  try {
    const response = await axios.get(`${API_BASE_URL}/movies`);
    return response.data;
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
};

// Function to fetch details of a specific movie by ID
export const fetchMovieDetails = async (movieId) => {
  
  try {
    const response = await axios.get(`${API_BASE_URL}/movies/${movieId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for movie ID ${movieId}:`, error);
    throw error;
  }
};

// Function to search for movies by title
export const searchMovies = async (query) => {
  
  try {
    const response = await axios.get(`${API_BASE_URL}/movies/search`, {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching for movies:', error);
    throw error;
  }
};