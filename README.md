# Trapt

A music playlist rating application built with React, Vite, and Vercel serverless functions.

## Prerequisites

- Node.js (v18 or higher recommended)
- PostgreSQL database
- npm or yarn package manager

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the root directory with the following variables:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/trapt"
   JWT_SECRET="your-secret-key-here"
   SPOTIFY_CLIENT_ID="your-spotify-client-id"
   SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"
   SPOTIFY_REDIRECT_URI="http://localhost:5173/api/spotify-proxy/callback"
   ```
   
   Replace the `DATABASE_URL` with your PostgreSQL connection string and set a secure `JWT_SECRET`.
   
   For Spotify integration, you'll need to:
   - Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Add `http://localhost:5173/api/spotify-proxy/callback` to your app's redirect URIs
   - Copy your Client ID and Client Secret to the `.env` file
   
   **Apple Music API Setup:**
   - Requires Apple Developer account with Media Identifier registered
   - See `APPLE_MUSIC_SETUP.md` for detailed setup instructions
   - After creating a private key, add to `.env`:
     ```env
     APPLE_MUSIC_TEAM_ID="your-team-id"
     APPLE_MUSIC_KEY_ID="your-key-id"
     APPLE_MUSIC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
     ```
   - Generate developer token: `node scripts/generate-apple-music-token.js`
   - The generated token will be saved to `.env` as `APPLE_MUSIC_DEVELOPER_TOKEN`

3. **Set up the database:**
   
   Generate the Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
   
   (Optional) Seed the database with initial data:
   ```bash
   npx prisma db seed
   ```

## Running the Local Development Server

This project requires two servers to run simultaneously:

### 1. Backend API Server (Port 3001)

In one terminal, start the Vercel development server:
```bash
npm run vercel:dev
```

This will start the API server on `http://localhost:3001` and handle all requests to `/api/*` endpoints.

### 2. Frontend Development Server

In a second terminal, start the Vite development server:
```bash
npm run dev
```

This will start the frontend on `http://localhost:5173` (or the next available port). The Vite server is configured to proxy all `/api/*` requests to the backend server on port 3001.

### Accessing the Application

Once both servers are running, open your browser and navigate to:
```
http://localhost:5173
```

## Available Scripts

- `npm run dev` - Start the Vite frontend development server
- `npm run vercel:dev` - Start the Vercel backend API server on port 3001
- `npm run build` - Generate Prisma client and build the project for production
- `npm run preview` - Preview the production build locally

## Project Structure

- `/src` - React frontend source code
- `/api` - Vercel serverless API functions
- `/prisma` - Database schema and migrations
- `/public` - Static assets

## Troubleshooting

- **Port 3001 already in use**: Make sure no other process is using port 3001, or modify the port in the `vercel:dev` script
- **Database connection errors**: Verify your `DATABASE_URL` is correct and your PostgreSQL server is running
- **API requests failing**: Ensure both the backend (`vercel:dev`) and frontend (`dev`) servers are running simultaneously

