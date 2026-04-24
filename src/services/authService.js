import axios from 'axios';

// Base URL for the API
const API_URL = process.env.REACT_APP_API_URL;

// Function to handle user registration
export const registerUser = async (userData) => {
  
  try {
    const response = await axios.post(`${API_URL}/register`, userData);
    return response.data;
  } catch (error) {
    throw new Error(error.response.data.message || 'Registration failed');
  }
};

// Function to handle user login
export const loginUser = async (credentials) => {
  
  try {
    const response = await axios.post(`${API_URL}/login`, credentials);
    return response.data;
  } catch (error) {
    throw new Error(error.response.data.message || 'Login failed');
  }
};

// Function to handle user logout
export const logoutUser = () => {
  
  localStorage.removeItem('user');
};

// Function to get the current user from local storage
export const getCurrentUser = () => {
  
  return JSON.parse(localStorage.getItem('user'));
};