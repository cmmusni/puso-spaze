# 🕊️ PUSO Spaze

**A Safe Space for Mental Health Support & Biblical Encouragement**

PUSO Spaze is a compassionate mental health support platform that provides a safe, anonymous space for individuals to share their struggles, receive encouragement, and find hope through community support and AI-powered biblical encouragement.

---

## 📖 Project Overview

**👉 [View Interactive Project Overview](https://cmmusni.github.io/puso-spaze/)** (Live on GitHub Pages)  
**👉 [View Local Overview](overview/index.html)** (Open in browser)

Explore the comprehensive project documentation at:
- Complete feature list with visual cards
- Detailed architecture diagrams
- Technology stack breakdown
- API endpoint documentation
- Database schema visualization
- Interactive navigation and beautiful UI

This overview page serves as comprehensive project documentation with an elegant, animated interface showcasing all aspects of PUSO Spaze.

---

## ✨ Key Features

### For Users
- 🙏 **Anonymous Posting** - Share struggles without revealing identity
- ❤️‍🩹 **Reaction System** - Express support (Pray, Care, Support)
- 💬 **Comments** - Engage with community members
- 🔔 **Notifications** - Stay updated on interactions
- 📱 **Cross-Platform** - Mobile (iOS/Android) via Expo

### For Coaches
- 📋 **Review Queue** - Moderate content flagged by AI
- 🚩 **Flag Posts** - Report inappropriate content
- ✅ **Approve/Reject** - Manage community safety

### For Admins
- 🎫 **Invite System** - Control access via invite codes
- 📍 **Pin Posts** - Highlight important messages
- 🗑️ **Delete Content** - Remove inappropriate posts
- 📊 **Full Moderation** - Complete platform oversight

### AI-Powered
- 🤖 **Auto-Moderation** - OpenAI content filtering
- 🙏 **Biblical Encouragement** - Hourly AI-generated Taglish messages for Gen Z
- 📝 **Smart Triggers** - Manual encouragement generation via admin API

---

## 🏗️ Tech Stack

### Frontend (Mobile)
- **React Native** with Expo
- TypeScript
- NativeWind (Tailwind CSS)
- Expo Secure Store for auth

### Backend (Server)
- **Node.js** + Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- OpenAI API (moderation & encouragement)
- Resend (email service)

### Deployment
- **Railway** - Server & database hosting
- **Expo EAS** - Mobile app builds & updates
- Automated migrations on deploy

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key (for moderation & encouragement)
- Expo CLI (for mobile development)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/puso-spaze.git
cd puso-spaze
```

2. **Install server dependencies**
```bash
cd server
npm install
```

3. **Configure environment variables**
```bash
# server/.env
DATABASE_URL="postgresql://user:password@localhost:5432/puso_spaze"
PORT=4000
OPENAI_API_KEY="your_openai_api_key"
ADMIN_SECRET="your_admin_secret"
ALLOWED_ORIGINS="http://localhost:8081,http://localhost:19006"
RESEND_API_KEY="your_resend_api_key"
FROM_EMAIL="noreply@yourdomain.com"
```

4. **Run database migrations**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Start the server**
```bash
npm run dev
```

6. **Install mobile app dependencies**
```bash
cd ../apps/mobile
npm install
```

7. **Configure mobile API URL**
```bash
# apps/mobile/app.json
# Update "apiUrl" to your local server: "http://localhost:4000"
```

8. **Start the mobile app**
```bash
npx expo start
```

---

## 📁 Project Structure

```
puso-spaze/
├── apps/
│   └── mobile/              # React Native mobile app
│       ├── components/      # UI components (PostCard, etc.)
│       ├── screens/         # App screens
│       ├── services/        # API client
│       ├── hooks/           # Custom React hooks
│       └── navigation/      # App navigation
├── server/                  # Express.js backend
│   ├── src/
│   │   ├── api/            # Route handlers
│   │   ├── controllers/    # Business logic
│   │   ├── services/       # AI & external services
│   │   └── middlewares/    # Express middlewares
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── migrations/     # Database migrations
├── packages/
│   ├── types/              # Shared TypeScript types
│   └── core/               # Shared utilities
├── overview/
│   └── index.html          # 📖 Interactive project overview
└── README.md               # You are here!
```

---

## 🔐 API Endpoints

### Public
- `POST /api/auth/redeem` - Redeem invite code
- `GET /api/posts` - Get all safe posts
- `POST /api/posts` - Create new post
- `DELETE /api/posts/:id` - Delete own post
- `GET/POST /api/posts/:id/reactions` - Reactions
- `GET/POST /api/posts/:id/comments` - Comments
- `GET /api/notifications` - Get user notifications

### Coach/Admin
- `GET /api/coach/review` - Review queue
- `PATCH /api/coach/posts/:id/moderate` - Approve/reject posts
- `PATCH /api/coach/posts/:id/flag` - Flag posts
- `PATCH /api/coach/comments/:id/moderate` - Moderate comments

### Admin (requires ADMIN_SECRET)
- `POST /api/admin/invite-codes` - Generate invite codes
- `POST /api/admin/invite-codes/send-email` - Email invite code
- `POST /api/admin/encouragement/trigger` - Manual encouragement post
- `POST /api/admin/posts/:id/pin` - Pin post
- `POST /api/admin/posts/:id/unpin` - Unpin post

---

## 🗄️ Database Schema

Key models:
- **User** - Accounts with roles (USER, COACH, ADMIN)
- **Post** - User posts with moderation status
- **Comment** - Comments on posts
- **Reaction** - User reactions (PRAY, CARE, SUPPORT)
- **Notification** - In-app notifications
- **InviteCode** - Access control system

See [schema.prisma](server/prisma/schema.prisma) for full details.

---

## 🚢 Deployment

### Server (Railway)
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically triggers on push to `main`
4. Run migrations after deploy:
```bash
railway run npx prisma migrate deploy
```

### Mobile App (Expo EAS)
1. Configure `eas.json`
2. Build for production:
```bash
eas build --platform all
```
3. Submit to app stores:
```bash
eas submit
```

---

## 🧪 Development Workflow

### Running Locally
```bash
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Mobile
cd apps/mobile && npx expo start
```

### Database Changes
```bash
cd server
npx prisma migrate dev --name description_of_change
npx prisma generate
```

### Type Safety
Shared types in `packages/types/index.ts` ensure consistency between frontend and backend.

---

## 📝 License

See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with ❤️ using:
- React Native & Expo
- Express.js & Prisma
- OpenAI API
- Railway & PostgreSQL

**PUSO** (Filipino for "heart") represents the compassionate core of this platform - providing hope, support, and biblical encouragement to those in need.

---

## 📞 Support

For issues or questions, please open an issue on GitHub or contact the development team.

**Remember: You are not alone. There is always hope. 🕊️**
