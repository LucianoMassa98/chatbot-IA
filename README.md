# Multichannel Chatbot Backend

A **production-ready, scalable MVC backend** for a multichannel chatbot supporting **WhatsApp Business API, Instagram Messaging API, and Facebook Messenger** using Node.js, Express, PostgreSQL, and Sequelize.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Setup](#project-setup)
6. [Meta Developer Setup](#meta-developer-setup)
7. [Database Configuration](#database-configuration)
8. [Environment Variables](#environment-variables)
9. [API Documentation](#api-documentation)
10. [Testing the Webhook](#testing-the-webhook)
11. [Deployment](#deployment)
12. [Project Structure](#project-structure)
13. [Troubleshooting](#troubleshooting)

---

## Overview

This is a **complete, production-ready backend** for a multichannel conversational chatbot. It handles messages from Meta's platforms (WhatsApp, Instagram, Facebook Messenger), normalizes them to a unified format, manages user sessions, and orchestrates intelligent conversation flows.

### Key Capabilities

✅ Unified message normalization across all channels  
✅ Session management with automatic expiration  
✅ Configurable conversation flows (Sales, Support, etc.)  
✅ AI fallback responses (mocked, ready for integration)  
✅ Message history tracking  
✅ Webhook verification and security  
✅ Scalable database design with PostgreSQL  
✅ Comprehensive logging  
✅ Error handling & validation with Joi  

---

## Features

### 1. **Message Handling**
- Receives messages from Meta webhook
- Normalizes messages from all channels (WhatsApp, Instagram, Messenger)
- Supports text, images, documents, audio, and video

### 2. **Session Management**
- Per-user session tracking
- Flow context persistence
- Automatic expiration after configurable timeout

### 3. **Conversation Flows**
- **Sales Flow**: Guides users through product inquiry → qualification → contact collection
- **Support Flow**: Guides users through problem identification → troubleshooting → escalation
- Extensible architecture for custom flows

### 4. **AI Integration**
- Mocked AI fallback response system
- Ready for OpenAI, Claude, or other LLM integration
- Automatic escalation detection for complex queries

### 5. **Database Tracking**
- Complete message history
- User profiles with metadata
- Conversation context storage
- Session state persistence

---

## Architecture

### MVC Structure

```
src/
├── models/          # Sequelize ORM models
├── controllers/     # Request/response handlers
├── services/        # Business logic & orchestration
│   ├── flows/       # Conversation flow handlers
│   ├── messageService.js    # Main message orchestrator
│   ├── sessionService.js    # Session management
│   ├── flowService.js       # Flow registration & execution
│   ├── aiService.js         # AI response generation
│   └── metaService.js       # Meta API communication
├── routes/          # API route definitions
├── schemas/         # Joi validation schemas
├── middleware/      # Express middleware
├── config/          # Configuration files
└── utils/           # Utility functions
```

### Data Flow

```
Meta Webhook → Controller → Validation → Services → Database
                                ↓
                          Message Normalization
                                ↓
                          Session Lookup
                                ↓
                          Flow Execution
                                ↓
                          Response Generation
                                ↓
                          Send via Meta API
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js ≥16 |
| **Framework** | Express 4.18+ |
| **Database** | PostgreSQL 12+ |
| **ORM** | Sequelize 6.35+ |
| **Validation** | Joi 17.11+ |
| **HTTP Client** | Axios 1.6+ |
| **Logging** | Winston 3.11+ |
| **Security** | Helmet, CORS |
| **Middleware** | Morgan, Body Parser |

---

## Project Setup

### Prerequisites

- **Node.js** v16+ ([Download](https://nodejs.org/))
- **npm** v8+ or **yarn**
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Git**

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/multichannel-chatbot-backend.git
cd multichannel-chatbot-backend
```

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 3: Configure Environment Variables

Copy the example file and update with your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=chatbot_user
DB_PASS=your_secure_password
DB_NAME=chatbot_db

# Meta
META_VERIFY_TOKEN=your_unique_verify_token_here
META_ACCESS_TOKEN=your_meta_access_token_here

# Session
SESSION_TIMEOUT=3600

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Step 4: Create PostgreSQL Database

```bash
# Open PostgreSQL CLI
psql -U postgres

# Create user
CREATE USER chatbot_user WITH PASSWORD 'your_secure_password';

# Create database
CREATE DATABASE chatbot_db OWNER chatbot_user;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE chatbot_db TO chatbot_user;

# Exit
\q
```

### Step 5: Run Database Migrations

```bash
npm run migrate
```

This will create all necessary tables:
- `users` - User profiles
- `conversations` - Conversation records
- `messages` - Message history
- `sessions` - Session state

### Step 6: Start the Server

**Development Mode** (with auto-reload):

```bash
npm run dev
```

**Production Mode**:

```bash
npm start
```

Expected output:

```
🚀 Server is running on port 3000
Environment: development
Health check: http://localhost:3000/health
```

### Step 7: Verify Setup

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "OK",
  "timestamp": "2024-05-01T10:00:00.000Z",
  "environment": "development"
}
```

---

## Meta Developer Setup

### Create Meta App

#### 1. Go to Meta for Developers

Navigate to [Meta for Developers](https://developers.facebook.com/) and sign in with your Meta account.

#### 2. Create a New App

1. Click **"My Apps"** in the top-right corner
2. Click **"Create App"**
3. Choose **"Business"** as app type
4. Fill in the form:
   - **App Name**: `Multichannel Chatbot`
   - **App Contact Email**: Your email
   - **App Purpose**: Customer engagement
5. Click **"Create App"**

#### 3. Add Products

In your app dashboard, click **"+ Add Product"** and add:

- ✅ **WhatsApp**
- ✅ **Messenger**
- ✅ **Instagram**

---

## WhatsApp Setup

### Step 1: Enable WhatsApp Business API

1. In your app, go to **"WhatsApp"** → **"Getting Started"**
2. Click **"Get Started"** button
3. Agree to the terms and proceed

### Step 2: Add a Phone Number

1. Go to **"WhatsApp"** → **"Phone Numbers"**
2. Click **"Add Phone Number"**
3. Select your country and provide a valid phone number
4. **IMPORTANT**: This must be a real phone number registered for WhatsApp Business

### Step 3: Get Credentials

1. Go to **"WhatsApp"** → **"API Setup"**
2. Note down:
   - **Phone Number ID**: `123456789` (use in webhook messages)
   - **Business Account ID**: for management
3. Go to **Settings** → **Basic** to get:
   - **Access Token**: Generate from App Roles page

### Step 4: Configure Webhook

1. Go to **"WhatsApp"** → **"Configuration"**
2. **Webhook URL**: `https://yourdomain.com/webhook/meta`
3. **Verify Token**: Set a custom token (e.g., `whatsapp_verify_token_2024`)
   - Add this to your `.env` file as `META_VERIFY_TOKEN`

### Step 5: Subscribe to Events

Under **"Webhook"** → **"Webhooks"**, subscribe to:

- ✅ `messages`
- ✅ `messaging_postbacks` (for interactive messages)
- ✅ `message_status` (for delivery tracking)

### Step 6: Test Connection

Use Postman or curl:

```bash
# Verify webhook
curl -X GET "https://yourdomain.com/webhook/meta?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=whatsapp_verify_token_2024"
```

---

## Facebook Messenger Setup

### Step 1: Create or Connect Facebook Page

1. Go to [Facebook.com](https://facebook.com) and create/log in to your page
2. In your Meta app, go to **"Messenger"** → **"Getting Started"**
3. Click **"Add or Remove Pages"**

### Step 2: Connect Your Page

1. Select your Facebook page from the list
2. Authorize the connection
3. Accept the required permissions

### Step 3: Generate Page Access Token

1. Go to **"Messenger"** → **"Settings"**
2. Under **"Access Tokens"**, click **"Generate Token"** for your page
3. Copy the token and save to `.env` as `META_ACCESS_TOKEN`

### Step 4: Subscribe to Webhook Events

1. Go to **"Messenger"** → **"Settings"** → **"Webhooks"**
2. Set:
   - **Callback URL**: `https://yourdomain.com/webhook/meta`
   - **Verify Token**: Same as WhatsApp (add to `.env`)
3. Subscribe to:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `message_reactions`

---

## Instagram Setup

### Step 1: Convert Account to Business

1. Go to your Instagram profile settings
2. Find **"Switch to Professional Account"** or **"Account Type"**
3. Choose **"Business"** or **"Creator"**
4. Link to your Facebook page (created above)

### Step 2: Enable Instagram Messaging API

1. In your Meta app, go to **"Instagram"** → **"Getting Started"**
2. Authorize your Instagram Business account
3. Accept the required permissions

### Step 3: Generate Access Token

1. Go to **"Settings"** → **"Basic"**
2. Use the same access token as Messenger (or generate a new one if needed)
3. Save to `.env` as `META_ACCESS_TOKEN`

### Step 4: Configure Webhook

1. Go to **"Instagram"** → **"Webhooks"**
2. Set the same webhook URL and verify token
3. Subscribe to:
   - ✅ `messages`
   - ✅ `messaging_status`

---

## Permissions Required

Your Meta app needs the following permissions. Request **Advanced Access** for most of them:

### WhatsApp Permissions

```
whatsapp_business_messaging
whatsapp_business_management
whatsapp_business_messaging_update  
```

### Messenger Permissions

```
pages_messaging
pages_manage_metadata
```

### Instagram Permissions

```
instagram_manage_messages
instagram_manage_metadata
```

### How to Request Advanced Access

1. Go to **App Roles** → **"Advanced Access"**
2. Find each permission in the list
3. Click **"Request"** or **"Upgrade"**
4. Follow Meta's verification process (may take 24-48 hours)

⚠️ **Note**: In development, you can use basic access with your own phone number and page.

---

## Database Configuration

### Default Connection Settings

```javascript
// src/config/database.js
{
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres'
}
```

### Database Models

#### `users`
- `id` (UUID) - Primary key
- `contact` (String) - Phone/email/handle
- `channel` (ENUM: whatsapp | instagram | messenger)
- `first_name` (String)
- `last_name` (String)
- `metadata` (JSONB) - Custom data
- `is_active` (Boolean)

#### `conversations`
- `id` (UUID) - Primary key
- `user_id` (FK) - Links to users
- `status` (ENUM: active | closed | waiting)
- `topic` (String) - Conversation topic
- `metadata` (JSONB) - Context data

#### `messages`
- `id` (UUID) - Primary key
- `conversation_id` (FK) - Links to conversations
- `direction` (ENUM: in | out)
- `content` (TEXT) - Message body
- `message_type` (ENUM: text | image | document | audio | video)
- `external_id` (String) - Meta message ID
- `metadata` (JSONB) - Attachments, etc.

#### `sessions`
- `id` (UUID) - Primary key
- `user_id` (FK, unique) - Links to users
- `current_flow` (ENUM: idle | sales | support | ai_fallback)
- `flow_step` (Integer) - Current flow step
- `context` (JSONB) - Flow-specific data
- `expires_at` (DateTime) - Session expiration
- `is_active` (Boolean)

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=chatbot_user
DB_PASS=secure_password_123
DB_NAME=chatbot_db

# Meta Configuration
META_VERIFY_TOKEN=your_unique_verify_token_here
META_ACCESS_TOKEN=your_meta_access_token_here

# Session Configuration
SESSION_TIMEOUT=3600

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# AI Configuration (optional)
AI_ENABLED=false
AI_API_KEY=
AI_API_URL=
```

### Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `chatbot_user` |
| `DB_PASS` | Database password | `secure_pass` |
| `DB_NAME` | Database name | `chatbot_db` |
| `META_VERIFY_TOKEN` | Webhook verification token | `my_secret_token` |
| `META_ACCESS_TOKEN` | Meta API access token | `EAAC...` |
| `SESSION_TIMEOUT` | Session timeout in seconds | `3600` (1 hour) |
| `LOG_LEVEL` | Logging level | `info`, `debug`, `error` |
| `LOG_FILE` | Log file location | `./logs/app.log` |

---

## API Documentation

### Endpoints

#### 1. Health Check

```
GET /health
```

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2024-05-01T10:00:00.000Z",
  "environment": "development"
}
```

---

#### 2. Root Endpoint

```
GET /
```

**Response**:
```json
{
  "message": "Multichannel Chatbot Backend API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "webhook": "/webhook/meta"
  }
}
```

---

#### 3. Webhook Verification (GET)

```
GET /webhook/meta?hub.mode=subscribe&hub.challenge=<challenge>&hub.verify_token=<token>
```

**Parameters**:
- `hub.mode`: Must be `subscribe`
- `hub.challenge`: Challenge string from Meta
- `hub.verify_token`: Must match `META_VERIFY_TOKEN`

**Response**: Returns the challenge string if token matches

**Example**:
```bash
curl -X GET "http://localhost:3000/webhook/meta?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=your_verify_token"
```

---

#### 4. Webhook Message Receiver (POST)

```
POST /webhook/meta
Content-Type: application/json
```

**Request Body** (from Meta):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "ENTRY_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "123456789"
        },
        "messages": [{
          "from": "1234567890",
          "id": "msg_id",
          "timestamp": "1682945000",
          "type": "text",
          "text": {
            "body": "Hello!"
          }
        }],
        "contacts": [{
          "profile": {
            "name": "John Doe"
          },
          "wa_id": "1234567890"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Response**:
```json
{
  "success": true
}
```

---

## Testing the Webhook

### Using Postman

#### 1. GET Request (Verify Webhook)

```
Method: GET
URL: http://localhost:3000/webhook/meta
Params:
  - hub.mode: subscribe
  - hub.challenge: test_challenge
  - hub.verify_token: <your_verify_token>
```

Expected response: `test_challenge`

---

#### 2. POST Request (Send Message)

```
Method: POST
URL: http://localhost:3000/webhook/meta
Headers:
  - Content-Type: application/json
Body (raw JSON):
```

**WhatsApp Message Example**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "entry_id",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "phone_number_id": "123456789"
        },
        "messages": [{
          "from": "1234567890",
          "id": "msg_123",
          "timestamp": "1682945000",
          "type": "text",
          "text": {
            "body": "I want to buy your product"
          }
        }],
        "contacts": [{
          "profile": {
            "name": "Jane Smith"
          },
          "wa_id": "1234567890"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Messenger Message Example**:
```json
{
  "object": "page",
  "entry": [{
    "id": "page_id",
    "messaging": [{
      "sender": {
        "id": "user_123"
      },
      "message": {
        "mid": "msg_456",
        "text": "How much does it cost?"
      }
    }]
  }]
}
```

---

### Using cURL

**Verify Webhook**:
```bash
curl -X GET "http://localhost:3000/webhook/meta?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=your_verify_token"
```

**Send Message**:
```bash
curl -X POST http://localhost:3000/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "messages": [{
            "from": "1234567890",
            "id": "msg_123",
            "timestamp": "1682945000",
            "type": "text",
            "text": {
              "body": "Hello bot!"
            }
          }]
        }
      }]
    }]
  }'
```

---

## Deployment

### Local Testing with ngrok

To test webhooks locally, use **ngrok** to expose your local server:

#### Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Windows
choco install ngrok

# Or download from https://ngrok.com/download
```

#### Step 2: Start ngrok

```bash
ngrok http 3000
```

Output:
```
Session Status     online
Version            3.3.5
Region            us
Forwarding         https://abc123def456.ngrok.io -> http://localhost:3000
```

#### Step 3: Update Meta Webhook URL

In your Meta app:
1. Go to **WhatsApp/Messenger/Instagram** → **Configuration**
2. Set webhook URL to: `https://abc123def456.ngrok.io/webhook/meta`
3. Test with your actual phone number

---

### Production Deployment

#### Prerequisites

- **HTTPS certificate** (required by Meta)
- **Domain name** (e.g., `api.chatbot.com`)
- **Cloud hosting** (AWS, Azure, Heroku, DigitalOcean, etc.)

#### Recommended Platforms

#### 1. **AWS EC2**

```bash
# Connect to instance
ssh -i key.pem ubuntu@your-instance-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Clone repo and install
git clone <your-repo> && cd multichannel-chatbot-backend
npm install

# Configure .env
nano .env

# Run migrations
npm run migrate

# Start with PM2
npm install -g pm2
pm2 start src/server.js --name "chatbot"
pm2 save
```

#### 2. **Heroku**

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-chatbot-app

# Add PostgreSQL add-on
heroku addons:create heroku-postgresql:standard-0 -a your-chatbot-app

# Set environment variables
heroku config:set \
  META_VERIFY_TOKEN=your_token \
  META_ACCESS_TOKEN=your_token \
  NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

#### 3. **Docker Deployment**

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

Build and run:

```bash
docker build -t chatbot-backend .
docker run -p 3000:3000 \
  -e DB_HOST=postgres \
  -e DB_USER=chatbot_user \
  -e DB_PASS=password \
  chatbot-backend
```

---

### SSL/HTTPS Configuration

#### Using Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificate location
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Auto-renewal

```bash
# Add cron job
sudo crontab -e

# Add: 0 0 1 * * certbot renew --quiet
```

---

### Monitoring and Logging

#### Check Logs

```bash
# Development
tail -f logs/app.log

# Production with PM2
pm2 logs chatbot
```

#### Monitor Performance

```bash
# CPU and memory
pm2 monit

# HTTP monitoring
npm install -g clinic
clinic doctor -- node src/server.js
```

---

## Project Structure

```
multichannel-chatbot-backend/
├── src/
│   ├── app.js                    # Express app initialization
│   ├── server.js                 # Server entry point
│   ├── models/                   # Sequelize models
│   │   ├── index.js              # Model initialization
│   │   ├── User.js               # User model
│   │   ├── Conversation.js       # Conversation model
│   │   ├── Message.js            # Message model
│   │   └── Session.js            # Session model
│   ├── controllers/              # Route controllers
│   │   └── webhookController.js  # Webhook handler
│   ├── services/                 # Business logic
│   │   ├── messageService.js     # Main orchestrator
│   │   ├── sessionService.js     # Session management
│   │   ├── flowService.js        # Flow registration
│   │   ├── aiService.js          # AI responses
│   │   ├── metaService.js        # Meta API communication
│   │   └── flows/
│   │       ├── salesFlow.js      # Sales conversation flow
│   │       └── supportFlow.js    # Support flow
│   ├── routes/                   # API routes
│   │   └── webhookRoutes.js      # Webhook routes
│   ├── schemas/                  # Joi validation
│   │   └── webhookSchema.js      # Webhook payload schema
│   ├── middleware/               # Express middleware
│   │   ├── errorHandler.js       # Global error handling
│   │   └── validation.js         # Request validation
│   ├── config/                   # Configuration
│   │   ├── database.js           # DB configuration
│   │   ├── env.js                # Environment variables
│   │   └── logger.js             # Winston logger
│   └── utils/                    # Utility functions
│       ├── AppError.js           # Custom error class
│       └── messageNormalizer.js  # Message formatting
├── migrations/                   # Database migrations
├── logs/                         # Application logs
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── .sequelizerc                  # Sequelize CLI config
├── package.json                  # Dependencies
├── README.md                     # This file
└── LICENSE                       # MIT License
```

---

## Troubleshooting

### Issue: Database Connection Failed

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify database credentials in `.env`
3. Ensure database exists: `psql -U postgres -l`

### Issue: Webhook Not Receiving Messages

**Error**: No messages arriving from Meta

**Solution**:
1. Verify webhook URL is accessible (use ngrok)
2. Check verify token matches: `META_VERIFY_TOKEN`
3. Ensure webhook is subscribed to `messages` event
4. Check Meta app permissions are approved
5. Verify phone number is correctly registered

### Issue: Port Already in Use

**Error**: `listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Issue: "Invalid Verify Token"

**Error**: 403 Forbidden when verifying webhook

**Solution**:
1. Check `META_VERIFY_TOKEN` in `.env`
2. Ensure token matches Meta app configuration
3. Verify no extra spaces or characters

### Issue: Database Migrations Not Running

**Error**: `Sequelize CLI: command not found`

**Solution**:
```bash
# Install Sequelize CLI globally
npm install -g sequelize-cli

# Or run with npx
npx sequelize-cli db:migrate
```

### Issue: Cannot Send Messages

**Error**: 401 Unauthorized

**Solution**:
1. Verify `META_ACCESS_TOKEN` is correct
2. Check token hasn't expired (Meta tokens expire after ~60 days)
3. Ensure Advanced Access is granted
4. Verify phone number is whitelisted for testing

### Issue: Messages Not Being Saved

**Error**: No messages in database

**Solution**:
1. Check database migrations ran: `npm run migrate`
2. Verify conversation is created: `SELECT * FROM conversations;`
3. Check logs: `tail -f logs/app.log`
4. Ensure `conversation_id` is valid UUID

---

## API Rate Limits

Meta API has rate limits:

- **WhatsApp**: 1,000 messages per second
- **Messenger**: 200 calls per second
- **Instagram**: 200 calls per second

Implement queue/throttling for production:

```bash
npm install bull redis
```

---

## Performance Tips

1. **Add Redis Caching** for session data
2. **Implement Message Queue** (Bull, RabbitMQ) for high volume
3. **Use Connection Pooling** in Sequelize
4. **Add CDN** for static content
5. **Enable Compression** middleware
6. **Monitor with New Relic** or DataDog

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open Pull Request

---

## License

MIT License - see LICENSE file for details

---

## Support

For issues and questions:
- 📧 Email: support@yourdomain.com
- 🐙 GitHub Issues: [Repository Issues](https://github.com/yourusername/multichannel-chatbot-backend/issues)
- 📖 Documentation: [Full Docs](https://yourdomain.com/docs)

---

## Changelog

### v1.0.0 (2024-05-01)
- ✅ Initial release
- ✅ WhatsApp, Messenger, Instagram integration
- ✅ Sales and Support flows
- ✅ Session management
- ✅ AI fallback (mocked)
- ✅ Complete documentation

---

**Made with ❤️ by Your Team**
