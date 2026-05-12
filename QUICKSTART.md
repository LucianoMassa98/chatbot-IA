# Quick Start Guide

Get your chatbot backend running in 5 minutes!

## Prerequisites

- Node.js v16+ ([Download](https://nodejs.org/))
- PostgreSQL 12+ ([Download](https://www.postgresql.org/))
- npm v8+ or yarn

## Installation (5 minutes)

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd multichannel-chatbot-backend
npm install
```

### 2. Create PostgreSQL Database

```bash
# Open PostgreSQL CLI
psql -U postgres

# Run these commands:
CREATE USER chatbot_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE chatbot_db OWNER chatbot_user;
GRANT ALL PRIVILEGES ON DATABASE chatbot_db TO chatbot_user;

# Exit
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=chatbot_user
DB_PASS=your_secure_password
DB_NAME=chatbot_db

META_VERIFY_TOKEN=your_unique_token_here
META_ACCESS_TOKEN=
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start Server

```bash
npm run dev
```

Expected output:
```
🚀 Server is running on port 3000
```

## Test It

```bash
# Health check
curl http://localhost:3000/health

# Should respond:
# {"status":"OK","timestamp":"...","environment":"development"}
```

## Next Steps

1. **Set up Meta App** - Follow the detailed guide in [README.md](README.md#meta-developer-setup)
2. **Configure Webhook** - Point your Meta webhook to `http://yourdomain.com/webhook/meta`
3. **Test Messages** - Send test messages via WhatsApp/Messenger/Instagram
4. **Deploy** - See [Deployment](README.md#deployment) section

## Common Commands

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start

# Run migrations
npm run migrate

# Lint code
npm run lint

# Run tests
npm test
```

## Debugging

Check logs:
```bash
tail -f logs/app.log
```

Enable debug mode:
```bash
NODE_ENV=development DEBUG=* npm run dev
```

## Troubleshooting

**Database connection error?**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env`

**Webhook not receiving messages?**
- Use ngrok: `ngrok http 3000`
- Update Meta webhook URL to ngrok URL
- Check verify token matches

**Port 3000 already in use?**
- Use different port: `PORT=3001 npm run dev`

## Need Help?

- See full [README.md](README.md) for detailed documentation
- Check [API_EXAMPLES.js](API_EXAMPLES.js) for payload examples
- Review [Troubleshooting](README.md#troubleshooting) section

---

**You're all set! 🚀**
