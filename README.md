# GrowMap

GrowMap is a web application that visualizes cannabis-related businesses, sensitive locations, and compliant zones on Google Maps.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables** in `.env.local`:
   ```bash
   GOOGLE_MAPS_API_KEY=your_server_side_api_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_client_maps_api_key
   # Optional: default map location
   NEXT_PUBLIC_DEFAULT_LOCATION=-34.9011,-56.1645
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

## Features

- Interactive map showing cannabis businesses and sensitive locations
- Filter system for different business categories
- Club-enabled zone analysis (150m from schools, cultural centers, etc.)

## Data Management

The app uses Google Places API with a local cache system. For production, set up a cron job to refresh the dataset:

```bash
curl -X POST https://your-domain/api/admin/sync-places \
  -H "Authorization: Bearer $SYNC_CRON_TOKEN"
```

For local development, use:
```bash
DEV_CRON_RUN_ON_START=true npm run dev:cron
```

## Deployment

Deploy to Vercel with the same environment variables. Ensure your Google Maps API keys have proper billing enabled.

## Tech Stack

- Next.js 14+ with App Router
- HeroUI for components
- Google Maps Platform
- TypeScript
