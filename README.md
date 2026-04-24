# Movie Streaming App

## Overview
The Movie Streaming App is a web application that allows users to browse, search, and watch movies. It features user authentication, a responsive design, and a clean user interface.

This project now includes:
- A React frontend
- A Node.js/Express backend
- A PostgreSQL-backed content catalog (with TMDB sync)

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
3. Install frontend and backend dependencies:
   ```
   npm run dev:install
   ```

## Usage
1. Create backend environment file:
   ```
   cp backend/.env.example backend/.env
   ```
2. Edit `backend/.env` and set `TMDB_READ_TOKEN`.
3. Start backend:
   ```
   npm run backend
   ```
4. In a new terminal, start frontend:
   ```
   npm start
   ```
5. Open your browser and go to `http://localhost:3000` to view the application.

## Environment Variables

### Frontend (.env)
- `REACT_APP_API_BASE_URL` Example: `http://localhost:5001/api`

### Backend (backend/.env)
- `TMDB_READ_TOKEN` TMDB v4 Read Access Token
- `PORT` Example: `5001`
- `ALLOWED_ORIGIN` Example: `http://localhost:3000`
- `DATABASE_URL` Preferred for cloud DB providers (format: `postgres://user:pass@host:5432/dbname?sslmode=require`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (alternative to `DATABASE_URL`)
- `DB_SSL` (`true`/`false`)
- `DB_SSL_REJECT_UNAUTHORIZED` (`true`/`false`)
- `ADMIN_SYNC_TOKEN` Bearer token required for `POST /api/admin/sync`

## Database Bootstrap

To create tables and seed initial catalog data in an empty database:

```bash
npm --prefix backend run db:bootstrap
```

This command:
- Creates required tables if missing
- Seeds movies/series/trending collections from TMDB
- Stores trailer metadata for playback

## Deployment

### Backend (Render)
- Deploy the `backend` folder as a Node service.
- Set env vars: `TMDB_READ_TOKEN`, `PORT`, `ALLOWED_ORIGIN`, and DB variables.

Recommended for cloud DB providers:
- `DATABASE_URL`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false` (only if your provider requires it)

Then run a one-time DB sync using:

```bash
curl -X POST https://your-render-service.onrender.com/api/admin/sync \
   -H "Authorization: Bearer YOUR_ADMIN_SYNC_TOKEN"
```

### Frontend (Vercel)
- Set env var: `REACT_APP_API_BASE_URL` to your backend URL with `/api`.
- Redeploy after updating environment variables.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.