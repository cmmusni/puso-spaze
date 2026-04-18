# Tech Context — PUSO Spaze

## Technologies

### Frontend (`apps/mobile/`)
| Technology | Version | Purpose |
|---|---|---|
| Expo | ~50.0.6 | Universal app framework (web + native) |
| React Native | 0.73.6 | Cross-platform UI |
| React | 18.2.0 | UI library |
| TypeScript | ~5.3 | Type safety |
| Zustand | ^4.5.0 | State management |
| Axios | ^1.6.7 | HTTP client |
| @react-navigation/drawer | ^6.7.2 | Navigation |
| expo-secure-store | ~12.8.1 | Secure storage (native) |
| AsyncStorage | 1.21.0 | Storage (web fallback) |
| expo-linear-gradient | ~12.7.2 | Gradient backgrounds |
| expo-image-picker | ~14.7.1 | Image uploads |
| expo-notifications | ~0.27.8 | Push notifications |
| expo-splash-screen | ~55.x | Native splash lifecycle control |
| NativeWind | ^2.0.11 | Tailwind CSS for RN |
| Plus Jakarta Sans / Be Vietnam Pro | Google Fonts | Typography |

### Backend (`server/`)
| Technology | Version | Purpose |
|---|---|---|
| Express | ^4.18.2 | HTTP server |
| TypeScript | ^5.3.3 | Type safety |
| Prisma | ^5.9.1 | ORM (PostgreSQL) |
| OpenAI | ^4.28.4 | Content moderation + encouragement generation |
| Multer | ^2.1.1 | File upload handling |
| node-cron | ^4.2.1 | Scheduled tasks (hourly hope, reminders) |
| Resend | ^6.9.2 | Email service |
| expo-server-sdk | ^6.0.0 | Push notification delivery |
| uuid | ^9.0.0 | UUID generation |
| jsonwebtoken | ^9.0.2 | JWT token auth |
| bcryptjs | ^2.4.3 | PIN hashing (if applicable) |

### Database
- PostgreSQL (hosted on Railway)
- Prisma ORM with migrations in `server/prisma/migrations/`

### Shared (`packages/`)
- `packages/types/index.ts` — Shared TypeScript interfaces
- `packages/core/` — Shared utilities (e.g., `generateAnonUsername`)

## Development Setup

### Server
```bash
cd server
npm install
npx prisma migrate dev    # Run migrations
npx prisma generate       # Generate Prisma client
npm run dev               # Start dev server (ts-node-dev)
```

### Mobile (Web)
```bash
cd apps/mobile
npm install
npm run web               # expo start --web --port 8081
```

### Mobile (Native)
```bash
cd apps/mobile
npx expo prebuild --platform android   # Generate native project
# Open android/ folder in Android Studio
# Or: npx expo start --android
```

### APK Build
```bash
npx eas build --profile preview --platform android        # Cloud build
npx eas build --profile preview --platform android --local # Local build
```

## Deployment
- **Server** → Railway (auto-deploy from GitHub, root: `/server`)
- **Web** → Vercel (root: `apps/mobile`, build: `expo export --platform web`)
- **Domain** → `puso-spaze.org` (web), `api.puso-spaze.org` (API)
- **Mobile** → Expo EAS builds + OTA updates

## Environment Variables (Server)
```
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=...
JWT_SECRET=...              # MUST override hardcoded default in production
ADMIN_SECRET=...            # MUST override hardcoded default in production
CLOUDINARY_CLOUD_NAME=...   # Cloudinary image hosting
CLOUDINARY_API_KEY=...      # Cloudinary API key
CLOUDINARY_API_SECRET=...   # Cloudinary API secret
GMAIL_USER=...
GMAIL_PASS=...
```

## Technical Constraints
- Web deviceId persisted in localStorage — cleared with browser cache
- Device ID enforcement on both native and web (since JWT + PIN update)
- Expo SDK 50 — must stay compatible with this version
- No password/email auth — identity is device-bound username + optional PIN
- PIN is 6-digit unique; 8-digit fallback on collision (10 retries)
- Recovery requests are public/unauthenticated — potential spam target
- `AppConfig` model exists in Prisma schema but has no corresponding service
- `webPushSubscription` (Json?) and `lastActiveAt` (DateTime) added to User model
- JSON body limit: 100kb; nesting depth limit: 10 levels
- Global null byte stripping on all request bodies and query params
