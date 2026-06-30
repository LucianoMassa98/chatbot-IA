/**
 * Application Constants
 */

// Channel Types
const CHANNELS = {
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  MESSENGER: 'messenger',
};

// Conversation Status
const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  WAITING: 'waiting',
};

// Message Direction
const MESSAGE_DIRECTION = {
  INBOUND: 'in',
  OUTBOUND: 'out',
};

// Message Types
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
};

// Flow Names
const FLOWS = {
  IDLE: 'idle',
  SALES: 'sales',
  SUPPORT: 'support',
  AI_FALLBACK: 'ai_fallback',
  MENU: 'menu',
  SUSCRIPCION: 'suscripcion',
  PEDIDOS: 'pedidos',
  CAMBIO_DIRECCION: 'cambio_direccion',
  REPROGRAMAR_ENTREGA: 'reprogramar_entrega',
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Error Types
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  META_API_ERROR: 'META_API_ERROR',
  SESSION_ERROR: 'SESSION_ERROR',
  FLOW_ERROR: 'FLOW_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// Meta API Messaging Products
const META_MESSAGING_PRODUCTS = {
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
};

// Default Values
const DEFAULTS = {
  PAGE_SIZE: 50,
  MAX_MESSAGE_LENGTH: 4096,
  SESSION_TIMEOUT_SECONDS: 3600,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

module.exports = {
  CHANNELS,
  CONVERSATION_STATUS,
  MESSAGE_DIRECTION,
  MESSAGE_TYPES,
  FLOWS,
  HTTP_STATUS,
  ERROR_TYPES,
  META_MESSAGING_PRODUCTS,
  DEFAULTS,
};
