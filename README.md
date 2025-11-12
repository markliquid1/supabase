# Alternator Regulator - My History Page

## Overview
Vercel-hosted page for displaying sensor history with Chart.js visualization.

## Files
- `index.html` - Main page with token validation and BatteryVoltage chart
- `styles.css` - CSS from ESP32 app (matches device styling)
- `vercel.json` - Vercel deployment configuration

## How It Works
1. ESP32 redirects user to: `https://your-app.vercel.app/?token=xxx`
2. Page validates token against Supabase `devices` table
3. Fetches `sensor_history` records for that device
4. Displays Battery Voltage (min/max/avg) vs time using Chart.js

## Deployment to Vercel

### First Time Setup
1. Create Vercel account at https://vercel.com
2. Install Vercel CLI: `npm i -g vercel`
3. Login: `vercel login`

### Deploy
```bash
vercel --prod
```

### Or Deploy via Git
1. Push to GitHub repo
2. Import project in Vercel dashboard
3. Auto-deploys on every push

## Testing Locally
1. Install `http-server`: `npm i -g http-server`
2. Run: `http-server -p 8080`
3. Open: `http://localhost:8080/?token=YOUR_TEST_TOKEN`

## Next Steps (Future Phases)
- Add time range selector (24h, 7d, 30d, all)
- Add more sensor charts (9 more)
- Leaderboards page
- Fleet Stats page
