# Deployment Guide - Cloudflare Pages

## Build Command

```bash
npm run build
```

## Output Directory

```bash
dist
```

## Environment Variables

Set these in Cloudflare Pages dashboard (Settings > Environment Variables):

### Build-time Variables (Client-side)

| Variable Name | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | The URL of your Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | The anonymous public key for your Supabase project. |

Admin accounts are granted server-side (SQL) until the org invite flow ships.

### Runtime Variables (Server-side, for Pages Functions)

| Variable Name | Description |
| :--- | :--- |
| `SUPABASE_URL` | The URL of your Supabase project (same value as VITE_SUPABASE_URL). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations (keep secret). |

### Optional Variables

| Variable Name | Description |
| :--- | :--- |
| `VITE_BOOKING_COM_API_KEY` | API key for Booking.com integration. |
| `VITE_EXPEDIA_API_KEY` | API key for Expedia integration. |
| `VITE_HOTELS_COM_API_KEY` | API key for Hotels.com integration. |

## Local Development

```bash
# Standard Vite dev server
npm run dev

# With Cloudflare Pages Functions (after building)
npm run build && npm run dev:cf
```

## Deploy

```bash
npm run deploy
```

Or connect your GitHub repository to Cloudflare Pages for automatic deployments on push.
