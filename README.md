# NEXA VISION AI V2

Next-generation AI Vision System with a futuristic, camera-first experience.

## Overview

NEXA VISION AI V2 combines Google authentication, browser camera capture, image upload, Gemini Vision analysis, persistent history, profiles, and settings in a responsive product-style interface.

## Features

- Google OAuth with persistent server-side sessions
- Responsive futuristic landing, dashboard, vision, history, profile, and settings pages
- Camera capture with mobile rear-camera preference
- JPG/JPEG/PNG/WEBP upload validation
- Backend-only Gemini Vision integration
- Structured AI results: description, objects, environment, insights, confidence
- PostgreSQL + Prisma persistence
- Analysis history and deletion
- Security middleware, rate limiting, validation, safe errors
- Android-browser friendly mobile-first UX

## Architecture

```text
React/Vite -> Express API -> Prisma/PostgreSQL
                         -> Google OAuth
                         -> Gemini Vision API
```

## Tech Stack

React, TypeScript, Vite, React Router, Node.js, Express, Passport Google OAuth, PostgreSQL, Prisma, Zod, Multer, Helmet, CORS, express-rate-limit, Gemini Vision API.

## Structure

```text
client/
  src/components
  src/hooks
  src/layouts
  src/lib
  src/pages
  src/services
  src/styles
  src/types
server/
  src/controllers
  src/lib
  src/middleware
  src/routes
  src/services
  src/types
prisma/
.github/workflows/ci.yml
.env.example
LICENSE
package.json
```

## Installation

Requirements: Node.js 20+, npm 10+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

Client: http://localhost:5173  
Server: http://localhost:3000

## Environment Variables

```env
PORT=3000
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=
SESSION_SECRET=
CLIENT_URL=http://localhost:5173
```

Never commit `.env` or secrets.

## Google OAuth Setup

Create a Google OAuth web client and use:

- Local origin: `http://localhost:5173`
- Local callback: `http://localhost:3000/api/auth/google/callback`

Use the deployed Vercel/Railway origins for production.

## Gemini API Setup

Set `GEMINI_API_KEY` only on the server. The browser never sends requests directly to Gemini.

## PostgreSQL / Prisma

Set `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:push
```

The `User` model owns many `Analysis` records.

## Development

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Production

```bash
npm run build
npm start
```

## Deployment

- Frontend: Vercel
- Backend: Railway
- Database: Railway PostgreSQL

Configure `CLIENT_URL` and CORS for the exact frontend origin in production.

## Android

The app is mobile-first and designed for modern Android browsers with camera support. Rear camera is preferred through `facingMode: environment`; the app falls back when unavailable. Camera streams are cleaned up when leaving the vision page.

## Troubleshooting

**Camera denied:** allow browser camera permission and use HTTPS in production.

**Google login error:** verify client ID, secret, callback URI, and consent-screen settings.

**AI error:** verify `GEMINI_API_KEY`, image format, size, and network access.

**Database error:** verify `DATABASE_URL` and rerun Prisma generation.

## License

MIT License — see [LICENSE](LICENSE).
