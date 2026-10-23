require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ── Database ────────────────────────────────────────────────
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_USER: process.env.DB_USER || 'chatbot_user',
  DB_PASS: process.env.DB_PASS || 'password',
  DB_NAME: process.env.DB_NAME || 'yemas_del_sol',

  // ── WhatsApp Business Cloud API (Meta) ──────────────────────
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'verify_token_secret',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID || '',

  // ── Mercado Pago ─────────────────────────────────────────────
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || '',
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY || '',
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
  MP_SUCCESS_URL: process.env.MP_SUCCESS_URL || '',
  MP_FAILURE_URL: process.env.MP_FAILURE_URL || '',
  MP_PENDING_URL: process.env.MP_PENDING_URL || '',

  // ── Google OAuth (CRM authentication) ───────────────────────
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  // CORS origin for the separate React CRM frontend
  CRM_FRONTEND_URL: process.env.CRM_FRONTEND_URL || 'http://localhost:5173',

  // ── App public URL (used for MP webhook notification_url) ────
  APP_URL: process.env.APP_URL || 'http://localhost:3000',

  // ── Session ──────────────────────────────────────────────────
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),

  // ── Logging ──────────────────────────────────────────────────
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || './logs/app.log',

  // ── AI Configuration (Google Gemini — fallback) ───────────────
  AI_ENABLED: process.env.AI_ENABLED === 'true',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'gemini-2.0-flash',
  AI_SYSTEM_PROMPT:
    process.env.AI_SYSTEM_PROMPT
    || 'Sos un asistente de Yemas del Sol, empresa argentina de venta de maples de huevos frescos. '
    + 'Respondé siempre en español, de forma amable y concisa. '
    + 'Si no podés resolver la consulta, derivá al cliente a un operador.',

  // ── Validation helpers ────────────────────────────────────────
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};
