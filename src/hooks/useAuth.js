import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { loginUser, registerUser } from '../services/authService';

/**
 * Custom hook to manage user authentication state.
 * Provides functions for logging in and registering users.
 */
const useAuth = () => {
  
  const { setAuthData } = useContext(AuthContext);
  const [error, setError] = useState(null);
  
  /**
   * Handles user login.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   */
  const login = async (email, password) => {
    try {
      const userData = await loginUser(email, password);
      setAuthData(userData);
    } catch (err) {
      setError(err.message);
    }
  };
  
  /**
   * Handles user registration.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   */
  const register = async (email, password) => {
    try {
      const userData = await registerUser(email, password);
      setAuthData(userData);
    } catch (err) {
      setError(err.message);
    }
  };
  
  return { login, register, error };
};

export default useAuth;