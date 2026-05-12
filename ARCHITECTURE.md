# Architecture Documentation

## Overview

This document provides a detailed explanation of the application's architecture, design patterns, and component interactions.

---

## Application Layers

### 1. **HTTP Layer (Express.js)**

Handles incoming HTTP requests and responses.

**Components:**
- Express application instance
- Middleware (logging, security, parsing)
- Route definitions
- Controller dispatch

**Flow:**
```
Request → Middleware → Route → Controller → Response
```

### 2. **Controller Layer**

Responsible for handling HTTP request/response only, no business logic.

**File:** `src/controllers/webhookController.js`

**Responsibilities:**
- Parse and validate incoming requests
- Call service methods
- Format responses
- Handle HTTP-level errors

**Example:**
```javascript
const handleWebhookMessage = async (req, res, next) => {
  // Validate
  const { object, entry } = req.body;
  
  // Call service
  const result = await messageService.processIncomingMessage(message);
  
  // Respond
  res.status(200).json({ success: true });
};
```

### 3. **Service Layer**

Contains all business logic and orchestration.

**Services:**

#### `messageService.js` (Orchestrator)
- Main message processing pipeline
- Coordinates between other services
- Manages user and conversation lifecycle

**Flow:**
```
1. Normalize message
2. Get/create user
3. Get/create conversation
4. Get/create session
5. Generate response
6. Save messages
```

#### `sessionService.js`
- Create and retrieve user sessions
- Update flow state
- Manage context data
- Handle session expiration

**Key Methods:**
- `getOrCreateSession(userId)` - Get or create session
- `updateFlow(userId, flowName)` - Update current flow
- `getSessionContext(userId)` - Retrieve session data
- `clearSession(userId)` - Reset session

#### `flowService.js`
- Flow registration system
- Flow step execution
- Flow triggering logic

**Key Methods:**
- `registerFlow(name, handler)` - Register a flow
- `executeFlowStep(flowName, step)` - Execute flow step
- `shouldStartFlow(flowName, message)` - Check if flow should start

#### `aiService.js`
- AI response generation (mocked)
- Fallback responses
- Escalation detection

**Key Methods:**
- `generateResponse(message, context)` - Generate AI response
- `shouldEscalate(message)` - Check if needs escalation

#### `metaService.js`
- Meta API communication
- Message sending abstraction
- Multi-channel support

**Key Methods:**
- `sendWhatsAppMessage(phoneId, phone, text)` - Send WhatsApp
- `sendMessengerMessage(userId, text)` - Send Messenger
- `sendInstagramMessage(userId, text)` - Send Instagram
- `sendMessage(channel, id, text)` - Generic sender

### 4. **Flow Layer** (Conversation Flows)

Encapsulates conversation logic for different scenarios.

**Files:**
- `src/services/flows/salesFlow.js`
- `src/services/flows/supportFlow.js`

**Flow Structure:**
```javascript
{
  name: 'sales',
  shouldStart: (message) => { /* trigger logic */ },
  steps: {
    0: async (message, context) => { /* step 0 */ },
    1: async (message, context) => { /* step 1 */ },
    // ...
  }
}
```

**Flow Execution:**
1. Check if message should trigger flow
2. Execute current step
3. Update session with next step
4. Return response

### 5. **Data Layer (Sequelize ORM)**

Manages database interactions.

**Models:**

#### User
```
id (UUID, PK)
contact (String, unique with channel)
channel (ENUM: whatsapp | instagram | messenger)
firstName, lastName
metadata (JSONB)
isActive (Boolean)
```

#### Conversation
```
id (UUID, PK)
userId (FK)
status (ENUM: active | closed | waiting)
topic (String)
metadata (JSONB)
```

#### Message
```
id (UUID, PK)
conversationId (FK)
direction (ENUM: in | out)
content (TEXT)
messageType (ENUM: text | image | document | etc)
externalId (String - Meta ID)
metadata (JSONB)
```

#### Session
```
id (UUID, PK)
userId (FK, unique)
currentFlow (ENUM: idle | sales | support | ai_fallback)
flowStep (Integer)
context (JSONB)
expiresAt (DateTime)
isActive (Boolean)
```

### 6. **Middleware Layer**

Cross-cutting concerns.

**Files:**
- `src/middleware/errorHandler.js` - Global error handling
- `src/middleware/validation.js` - Request validation

**Middleware Stack:**
```
1. Helmet (Security headers)
2. CORS (Cross-origin requests)
3. Body Parser (JSON parsing)
4. Morgan (Logging)
5. Route-specific validation
6. Controller
7. Error Handler
```

### 7. **Configuration Layer**

Environment and application configuration.

**Files:**
- `src/config/env.js` - Environment variables
- `src/config/database.js` - Database configuration
- `src/config/logger.js` - Winston logger setup

---

## Data Flow Examples

### Example 1: Incoming WhatsApp Message

```
Meta Webhook
    ↓
POST /webhook/meta
    ↓
webhookController.handleWebhookMessage()
    ↓
messageNormalizer.normalizeMessage()
    ↓
messageService.processIncomingMessage()
    ├→ getOrCreateUser()
    ├→ getOrCreateConversation()
    ├→ Message.create() [incoming message]
    ├→ sessionService.getOrCreateSession()
    ├→ generateResponse()
    │   ├→ flowService.executeFlowStep() OR
    │   └→ aiService.generateResponse()
    ├→ Message.create() [outgoing message]
    └→ Response to webhook
```

### Example 2: Sales Flow Execution

```
User Message: "I want to buy your premium product"
    ↓
flowService.shouldStartFlow('sales') → true
    ↓
sessionService.updateFlow(userId, 'sales', 0)
    ↓
flowService.executeFlowStep('sales', 0, message)
    ↓
salesFlow.steps[0](message, context)
    ↓
Response: "Welcome! I'd be happy to help..."
    ↓
sessionService.updateFlow(userId, 'sales', 1)
    ↓
Save message and respond
```

### Example 3: Session-Based Flow Continuation

```
Existing User Message: "Tell me about premium"
    ↓
sessionService.getSessionContext(userId)
    ├→ currentFlow: 'sales'
    ├→ flowStep: 1
    └→ context: { /* previous data */ }
    ↓
Check if still in flow (currentFlow !== 'idle')
    ↓
flowService.executeFlowStep('sales', 1, message)
    ↓
salesFlow.steps[1](message, context)
    ↓
Response: "Great! I see you're interested in..."
    ↓
sessionService.updateFlow(userId, 'sales', 2)
```

---

## Design Patterns

### 1. **MVC Pattern**
- Models: Sequelize ORM
- Views: JSON responses
- Controllers: Request handlers
- Services: Business logic

### 2. **Service Locator Pattern**
Services are instantiated as singletons and exported:
```javascript
// metaService.js
module.exports = new MetaService();

// Usage anywhere
const metaService = require('./metaService');
```

### 3. **Strategy Pattern**
Different flows implement the same interface:
```javascript
const flow = {
  shouldStart: (message) => { /* strategy */ },
  steps: { /* execution steps */ }
};
```

### 4. **Pipeline Pattern**
Message processing follows a pipeline:
```
Normalize → Validate → Process → Respond → Log
```

### 5. **Factory Pattern**
Session creation:
```javascript
async getOrCreateSession(userId) {
  let session = await Session.findOne({ ... });
  if (!session) {
    session = await Session.create({ ... }); // Factory
  }
  return session;
}
```

---

## Error Handling

### Error Hierarchy

```
Error
└── AppError (Custom)
    ├── Validation Error (400)
    ├── Authentication Error (401)
    ├── Not Found Error (404)
    ├── Conflict Error (409)
    └── Server Error (500)
```

### Error Handling Middleware

```javascript
// errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error(err);
  
  // Format response
  res.status(err.statusCode).json({
    success: false,
    message: err.message
  });
};
```

### Async Error Wrapping

```javascript
// Wrap async routes to catch errors
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage
router.post('/webhook', catchAsync(handleWebhookMessage));
```

---

## Database Schema

### Entity Relationships

```
User (1) ──→ (M) Conversation ──→ (M) Message
  ↓
  └─→ (1) Session
```

### Indexes

- `users(contact, channel)` - Unique
- `conversations(user_id)` - Foreign key
- `messages(conversation_id)` - Foreign key
- `sessions(user_id)` - Unique

---

## Scalability Considerations

### Current Implementation
- Single-process Node.js server
- In-memory session management
- Synchronous database queries

### For Scale-Up

#### 1. **Horizontal Scaling**
- Use load balancer (NGINX, AWS ALB)
- Deploy multiple server instances
- Use Redis for distributed sessions

```javascript
// Redis session store
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient();
app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ...
}));
```

#### 2. **Message Queue**
- Replace direct message processing with queue
- Use Bull, RabbitMQ, or AWS SQS

```javascript
const queue = new Queue('messages', redisURL);
queue.add(messageData); // Producer
queue.process(async (job) => { // Consumer
  await messageService.processIncomingMessage(job.data);
});
```

#### 3. **Caching**
- Cache user and session data
- Cache flow definitions

```javascript
const redis = require('redis');
const client = redis.createClient();

// Cache user
await client.set(`user:${userId}`, JSON.stringify(user));
const cached = await client.get(`user:${userId}`);
```

#### 4. **Database Optimization**
- Add connection pooling
- Use read replicas
- Implement query optimization
- Add database monitoring

```javascript
const sequelize = new Sequelize({
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000
  }
});
```

---

## Logging Strategy

### Log Levels
- `error` - Error events
- `warn` - Warning events
- `info` - Informational events
- `debug` - Debug events

### Log Structure
```json
{
  "timestamp": "2024-05-01T10:00:00.000Z",
  "level": "info",
  "message": "Message processed successfully",
  "service": "chatbot-backend",
  "userId": "user-123",
  "channel": "whatsapp"
}
```

### Log Output
- Console (development)
- Files (all environments)
- Error file (production)

---

## Testing Strategy

### Unit Tests
- Service methods
- Flow logic
- Utility functions

### Integration Tests
- Database operations
- API endpoints
- Service coordination

### End-to-End Tests
- Webhook reception
- Message processing
- Response delivery

---

## Security Considerations

### 1. **Input Validation**
- Joi schema validation
- Sanitization
- Type checking

### 2. **API Security**
- Helmet headers
- CORS configuration
- Rate limiting (TODO)

### 3. **Authentication**
- Verify token validation
- Access token management
- Key rotation

### 4. **Data Protection**
- HTTPS/TLS
- Encrypted database connections
- Sensitive data logging redaction

### 5. **Error Disclosure**
- Don't expose stack traces in production
- Generic error messages
- Detailed logging internally

---

## Performance Optimization

### Database Optimization
```javascript
// Eager loading
const user = await User.findOne({
  include: [
    { association: 'conversations', limit: 10 },
    { association: 'session' }
  ]
});

// Pagination
const conversations = await Conversation.findAll({
  where: { user_id: userId },
  limit: 50,
  offset: (page - 1) * 50
});

// Indexes
await queryInterface.addIndex('conversations', ['user_id']);
```

### Caching Strategy
```javascript
// Cache session context
const session = await cache.get(`session:${userId}`)
  || await Session.findOne({ user_id: userId });
```

### Async Operations
```javascript
// Parallel processing
const [user, conversation, session] = await Promise.all([
  User.findOne(...),
  Conversation.findOne(...),
  Session.findOne(...)
]);
```

---

## Deployment Architecture

### Development
```
Local Machine
├── Node.js Server (port 3000)
├── PostgreSQL Local
└── Logs (file)
```

### Production
```
        Internet (HTTPS)
             ↓
        Load Balancer
             ↓
   ┌────────┴────────┐
   ↓                 ↓
App Server 1    App Server 2
   └────────┬────────┘
        Redis (Sessions)
        PostgreSQL (Primary)
        PostgreSQL Replica
```

---

## Future Enhancements

1. **AI Integration** - OpenAI, Claude, or Cohere
2. **Sentiment Analysis** - Detect customer sentiment
3. **Analytics Dashboard** - Conversation metrics
4. **A/B Testing** - Test different flows
5. **Multi-language Support** - Auto-translation
6. **Voice/Video Support** - Audio/video messaging
7. **CRM Integration** - Sync with external CRM
8. **Advanced Escalation** - Smart agent routing

---

## Maintenance

### Regular Tasks
- Monitor logs for errors
- Review performance metrics
- Update dependencies
- Rotate access tokens
- Backup databases
- Review security

### Monitoring Tools
- PM2 (process management)
- Winston (logging)
- New Relic / DataDog (APM)
- Sentry (error tracking)

---

**Last Updated:** May 1, 2024
**Maintainer:** Development Team
