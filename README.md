# GrowMap

GrowMap is a Next.js + HeroUI web application that visualises cannabis-related businesses, sensitive locations, and compliant club-enabled zones on top of Google Maps.

## Getting Started

1. Install dependencies

   ```bash
   pnpm install
   # or
   npm install
   ```

2. Configure environment variables in `.env.local`:

   ```bash
   GOOGLE_MAPS_API_KEY=your_server_side_places_api_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_client_maps_api_key
   # Optional: default map focus, Barcelona fallback is used otherwise
   NEXT_PUBLIC_DEFAULT_LOCATION=-34.9011,-56.1645
   # Optional: override dataset location when the default ./data/cache path is not writable
   PLACE_CACHE_DIR=./data/cache
   # PLACE_CACHE_FILE=/absolute/path/to/montevideo-places.json
   ```

3. Run the development server

   ```bash
   npm run dev
   ```

## Feature Highlights

- **HeroUI experience**: responsive sidebar, modal filters for mobile, and polished map overlays.
- **Data sourcing**: Google Places Text Search API with an on-disk cache refreshed by the sync cron.
- **Club-enabled analysis**: H3 hexagon grid computes areas 150 m away from schools, cultural and rehabilitation centres.
- **Filtering**: business and restricted categories with adjustable search radius; toggling club zones updates overlays live.
- **Resilience**: graceful error states and recovery messaging when API keys or datasets are missing.

## Syncing Place Data

Run the scheduled sync endpoint to refresh the Montevideo dataset and populate the on-disk cache used by the map and club-enabled zones:

```bash
curl -X POST https://your-domain/api/admin/sync-places \
  -H "Authorization: Bearer $SYNC_CRON_TOKEN"
```

Trigger this endpoint periodically (e.g. every few hours) with your preferred cron service. Set the `SYNC_CRON_TOKEN` environment variable to protect the endpoint.

Once the cache exists, API routes serve requests from this dataset instead of querying Google Places directly, which keeps the backend deterministic and avoids rate limits. If the dataset is missing, the APIs return a 503 so the UI can prompt you to run the sync job.

## Deploying to Vercel

- API routes that touch the dataset opt into the Node.js runtime so file-system access works in serverless functions.
- Commit `data/cache/montevideo-places.json` (or point `PLACE_CACHE_FILE` to another readable path) so the dataset is available at runtime.
- Serverless instances cannot persist writes to the repository path; run the sync cron offline or in a scheduled job that updates your external storage and triggers a redeploy.
- Configure the same environment variables in your Vercel project (`GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `PLACE_CACHE_FILE`, etc.) before deploying.

### Local development cron

For local testing you can run the built-in cron runner which executes the sync job on a schedule (hourly by default):

```bash
DEV_CRON_RUN_ON_START=true npm run dev:cron
```

Use `DEV_CRON_SCHEDULE` to override the cron expression (e.g. `*/10 * * * *` for every 10 minutes) and `DEV_CRON_TIMEZONE` to pin a timezone if desired.

## Project Structure

- `app/` – Next.js App Router structure and API routes.
- `components/` – UI pieces (filters, map, overlays, loading states).
- `lib/` – configuration, Google Places client, geospatial utilities, and safe-zone computations.
- `public/data/` – static data assets bundled with the app.
- `types/` – shared TypeScript domain models.

## Next Steps

- Connect production API keys and enable billing for Google Maps Platform.
- Persist user preferences (filters, map viewport) locally.
- Enrich the map with additional data providers (e.g., Open Data portals) to complement Google Places.
