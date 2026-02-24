# Hourly Biblical Encouragement Posts

## Overview
The PUSO Spaze server now automatically generates and posts AI-powered biblical encouragement messages every hour. These posts are created by a system user called "Hourly Hope" and appear in the main feed alongside user posts.

## Features

### 🤖 AI-Generated Content
- Uses OpenAI's GPT-4o-mini to generate short, heartfelt biblical encouragements
- Each message is 1-3 sentences (max 280 characters)
- Includes relevant Bible verses when appropriate
- Addresses common struggles: anxiety, loneliness, doubt, fear, hope, faith

### ⏰ Automatic Scheduling
- Posts are created automatically every hour at :00 (e.g., 9:00, 10:00, 11:00)
- Runs using node-cron scheduler
- Schedule can be modified in `encouragementScheduler.ts`

### 🔒 Safety & Moderation
- All AI-generated content goes through the moderation service
- Posts are tagged with: `['encouragement', 'daily', 'scripture']`
- System user has ADMIN role for official status

### 🎯 Fallback Messages
- If OpenAI API is unavailable, the system uses pre-written encouragements
- Ensures reliable delivery even during API outages
- 8 handpicked biblical encouragements as fallback options

## Configuration

### Environment Variables
Make sure your `.env` file includes:
```bash
OPENAI_API_KEY=your-openai-api-key-here
ADMIN_SECRET=pusocoach_admin_2026  # For admin endpoints
```

### Schedule Customization
Edit `/server/src/services/encouragementScheduler.ts`:

```typescript
// Current: Every hour at :00
const schedule = '0 * * * *';

// For testing: Every 5 minutes
const schedule = '*/5 * * * *';

// Daily at 9 AM
const schedule = '0 9 * * *';

// Every 4 hours
const schedule = '0 */4 * * *';
```

## Manual Test Endpoint

### Trigger an encouragement post immediately
```bash
curl -X POST http://localhost:4000/api/admin/encouragement/trigger \
  -H "Authorization: Bearer pusocoach_admin_2026" \
  -H "Content-Type: application/json"
```

### Response
```json
{
  "success": true,
  "message": "Encouragement post created successfully"
}
```

## Architecture

### Files Created
1. **`/server/src/services/biblicalEncouragementService.ts`**
   - AI content generation
   - Fallback message selection
   - OpenAI integration

2. **`/server/src/services/encouragementScheduler.ts`**
   - Cron job setup
   - System user management
   - Post creation logic
   - Manual trigger function

3. **Updated files:**
   - `/server/src/index.ts` - Starts scheduler on server boot
   - `/server/src/api/adminRoutes.ts` - Added manual trigger endpoint

### System User
- **ID:** `system-encouragement-bot`
- **Display Name:** `Hourly Hope`
- **Role:** `ADMIN`
- **Auto-created** on first post if doesn't exist

## Example Generated Posts

> "When anxiety overwhelms you, remember: God has not given us a spirit of fear, but of power, love, and a sound mind. (2 Timothy 1:7) You are held in His perfect peace today. 🕊️"

> "Feeling alone? You're never walking this path by yourself. The Lord is near to the brokenhearted and saves the crushed in spirit. (Psalm 34:18) Lean into His presence today."

> "Your worth isn't found in your productivity or performance. You are fearfully and wonderfully made (Psalm 139:14), deeply loved, and chosen by God. Rest in that truth today."

## Logs

When the server starts, you'll see:
```
🕐 Encouragement scheduler started (runs every hour)
```

When a post is created:
```
🌟 Generating hourly biblical encouragement...
✅ Created system user for encouragement posts
✅ Posted encouragement: {
  id: '...',
  preview: 'When hope feels distant...',
  time: '2026-02-24T23:48:41.686Z'
}
```

## Customization

### Change AI Prompt
Edit the system message in `biblicalEncouragementService.ts` to adjust:
- Tone and style
- Length preferences
- Topic focus
- Formatting preferences

### Add More Fallback Messages
Edit the `getFallbackEncouragement()` function in `biblicalEncouragementService.ts`

### Disable Auto-posting
Comment out `startEncouragementScheduler()` in `/server/src/index.ts`

### Post on Startup
Uncomment this line in `encouragementScheduler.ts`:
```typescript
postEncouragement().catch(console.error);
```

## Dependencies
- `node-cron` - Task scheduling
- `@types/node-cron` - TypeScript definitions
- `openai` - AI content generation (already installed)

## Future Enhancements
- [ ] User preferences to opt-in/out of encouragement posts
- [ ] Time zone-aware scheduling
- [ ] Themed encouragements (morning motivation, evening peace, etc.)
- [ ] Analytics on engagement with encouragement posts
- [ ] Multiple languages support
- [ ] Integration with church calendar/liturgical seasons
