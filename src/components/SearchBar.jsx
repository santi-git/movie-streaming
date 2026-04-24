import React, { useState } from 'react';

/**
 * SearchBar component allows users to search for movies.
 * It maintains the search input state and handles the search action.
 */
const SearchBar = ({ onSearch }) => {
  
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Handles the change event for the search input.
   * Updates the searchTerm state with the current input value.
   */
  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
  };

  /**
   * Handles the form submission event.
   * Prevents the default form submission and triggers the search action.
   */
  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search for movies..."
        value={searchTerm}
        onChange={handleInputChange}
      />
      <button type="submit">Search</button>
    </form>
  );
};

export default SearchBar;