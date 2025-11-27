# Deployment Guide

## Environment Variables

The following environment variables are required for the application to function correctly in production. Ensure these are set in your deployment platform (e.g., Netlify, Vercel).

| Variable Name | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | The URL of your Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | The anonymous public key for your Supabase project. |
| `VITE_ADMIN_INVITE_CODE` | The code required to create a new admin account. |

### Optional Variables (Third-Party APIs)

| Variable Name | Description |
| :--- | :--- |
| `VITE_BOOKING_COM_API_KEY` | API key for Booking.com integration. |
| `VITE_EXPEDIA_API_KEY` | API key for Expedia integration. |
| `VITE_HOTELS_COM_API_KEY` | API key for Hotels.com integration. |

## Build Command

```bash
npm run build
```

## Output Directory

```bash
dist
```
