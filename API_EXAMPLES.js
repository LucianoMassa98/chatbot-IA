/**
 * API Examples
 * 
 * This file contains example payloads for testing the chatbot backend
 * Use these with Postman, cURL, or your preferred API client
 */

// ============================================================================
// WEBHOOK VERIFICATION (GET Request)
// ============================================================================

/*
URL: http://localhost:3000/webhook/meta
Method: GET
Parameters:
  - hub.mode: subscribe
  - hub.challenge: test_challenge
  - hub.verify_token: your_verify_token_here

Response: test_challenge
*/

// ============================================================================
// WHATSAPP MESSAGE (POST Request)
// ============================================================================

/*
URL: http://localhost:3000/webhook/meta
Method: POST
Content-Type: application/json

Body:
*/
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "ENTRY_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "1234567890",
              "phone_number_id": "123456789"
            },
            "messages": [
              {
                "from": "1234567890",
                "id": "wamid.gBGE2DE0FBE.AAAAAF-message-id",
                "timestamp": "1682945000",
                "type": "text",
                "text": {
                  "body": "I want to buy your premium product"
                }
              }
            ],
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "1234567890"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}

// ============================================================================
// FACEBOOK MESSENGER MESSAGE
// ============================================================================

/*
URL: http://localhost:3000/webhook/meta
Method: POST
Content-Type: application/json

Body:
*/
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": 1682945000,
      "messaging": [
        {
          "sender": {
            "id": "USER_ID"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": 1682945000,
          "message": {
            "mid": "m_mid",
            "text": "How much does it cost?"
          }
        }
      ]
    }
  ]
}

// ============================================================================
// INSTAGRAM MESSAGE
// ============================================================================

/*
URL: http://localhost:3000/webhook/meta
Method: POST
Content-Type: application/json

Body:
*/
{
  "object": "instagram",
  "entry": [
    {
      "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
      "time": 1682945000,
      "messaging": [
        {
          "sender": {
            "id": "SENDER_ID"
          },
          "recipient": {
            "id": "RECIPIENT_ID"
          },
          "timestamp": 1682945000,
          "message": {
            "mid": "MESSAGE_ID",
            "text": "I need support with my account"
          }
        }
      ]
    }
  ]
}

// ============================================================================
// WHATSAPP MESSAGE WITH IMAGE
// ============================================================================

/*
Body:
*/
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "ENTRY_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "123456789"
            },
            "messages": [
              {
                "from": "1234567890",
                "id": "wamid.gBGE2DE0FBE.AAAAAF-image-id",
                "timestamp": "1682945000",
                "type": "image",
                "image": {
                  "mime_type": "image/jpeg",
                  "sha256": "hash_value",
                  "id": "image_id"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}

// ============================================================================
// MESSAGE STATUS UPDATE (DELIVERY CONFIRMATION)
// ============================================================================

/*
Body:
*/
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "ENTRY_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "123456789"
            },
            "statuses": [
              {
                "id": "wamid.gBGE2DE0FBE.AAAAAF-status-id",
                "status": "delivered",
                "timestamp": "1682945000",
                "recipient_id": "1234567890",
                "conversation": {
                  "id": "conversation_id",
                  "expiration_timestamp": "1682948600"
                }
              }
            ]
          },
          "field": "message_status"
        }
      ]
    }
  ]
}

// ============================================================================
// CURL EXAMPLES
// ============================================================================

/*

# Verify Webhook
curl -X GET "http://localhost:3000/webhook/meta?hub.mode=subscribe&hub.challenge=test_challenge&hub.verify_token=your_verify_token"

# Send WhatsApp Message
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
              "body": "Hello, I want to buy something"
            }
          }]
        }
      }]
    }]
  }'

# Send Messenger Message
curl -X POST http://localhost:3000/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "messaging": [{
        "sender": {"id": "user_123"},
        "message": {"mid": "msg_456", "text": "Can you help me?"}
      }]
    }]
  }'

# Check Health
curl http://localhost:3000/health

# Check Root Endpoint
curl http://localhost:3000/

*/

// ============================================================================
// EXPECTED RESPONSES
// ============================================================================

/*

Health Check Response:
{
  "status": "OK",
  "timestamp": "2024-05-01T10:00:00.000Z",
  "environment": "development"
}

Root Endpoint Response:
{
  "message": "Multichannel Chatbot Backend API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "webhook": "/webhook/meta"
  }
}

Webhook Receipt Response:
{
  "success": true
}

Error Response Example:
{
  "success": false,
  "message": "Validation Error: [{ field: 'hub.verify_token', message: 'Invalid verify token' }]"
}

*/

// ============================================================================
// CONVERSATION FLOW EXAMPLES
// ============================================================================

/*

1. SALES FLOW
   User: "I want to buy your premium product"
   Bot: "Welcome! I'd be happy to help you with our products. What are you interested in?"
   
   User: "Tell me about the premium plan"
   Bot: "Great! I see you're interested in our premium offering. Let me connect you with a sales representative..."
   
   User: "Sure, here's my email: john@example.com"
   Bot: "Thank you! Our sales team will contact you within 24 hours."

2. SUPPORT FLOW
   User: "I'm having trouble logging in"
   Bot: "I'm here to help! Can you briefly describe the issue you're experiencing?"
   
   User: "I can't remember my password"
   Bot: "I understand. Let me provide some troubleshooting steps for your authentication issue..."
   
   User: "I've tried everything, still not working"
   Bot: "A support specialist will reach out to you within 2 hours."

3. AI FALLBACK
   User: "Hello, how are you?"
   Bot: "Hello! 👋 How can I assist you today?"
   
   User: "Thank you so much!"
   Bot: "You're welcome! Is there anything else I can help you with?"

*/
