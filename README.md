# Movie Streaming App

## Overview
The Movie Streaming App is a web application that allows users to browse, search, and watch movies. It features user authentication, a responsive design, and a clean user interface.

## Features
- User authentication (login and registration)
- Movie browsing and searching
- Detailed movie information
- Video playback for selected movies
- Responsive design for various devices

## Technologies Used
- React.js for building the user interface
- JavaScript for application logic
- CSS for styling
- Axios for API calls
- Context API for state management

## Project Structure
```
movie-streaming-app
├── src
│   ├── app.js                # Entry point of the application
│   ├── components             # Reusable components
│   ├── pages                  # Application pages
│   ├── routes                 # Routing configuration
│   ├── context                # Context API for state management
│   ├── hooks                  # Custom hooks
│   ├── services               # API and authentication services
│   └── styles                 # CSS styles
├── public
│   └── index.html            # Main HTML file
├── package.json              # Project dependencies and scripts
├── .env                      # Environment variables
├── .gitignore                # Files to ignore in Git
└── README.md                 # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd movie-streaming-app
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage
1. Start the development server:
   ```
   npm start
   ```
2. Open your browser and go to `http://localhost:3000` to view the application.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.