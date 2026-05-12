const Joi = require('joi');

const webhookPayloadSchema = Joi.object({
  object: Joi.string().valid('whatsapp_business_account', 'page', 'instagram').required(),
  entry: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      changes: Joi.array().items(
        Joi.object({
          value: Joi.object({
            messaging_product: Joi.string().valid('whatsapp', 'instagram', 'facebook').required(),
            metadata: Joi.object({
              display_phone_number: Joi.string(),
              phone_number_id: Joi.string(),
              recipient_id: Joi.string(),
            }).optional(),
            contacts: Joi.array().items(
              Joi.object({
                profile: Joi.object({
                  name: Joi.string().optional(),
                }).optional(),
                wa_id: Joi.string().optional(),
              }),
            ).optional(),
            messages: Joi.array().items(
              Joi.object({
                from: Joi.string().required(),
                id: Joi.string().required(),
                timestamp: Joi.string().required(),
                type: Joi.string().valid('text', 'image', 'document', 'audio', 'video', 'button', 'interactive').required(),
                text: Joi.object({
                  body: Joi.string().required(),
                }).when('type', { is: 'text', then: Joi.required() }),
                image: Joi.object({
                  mime_type: Joi.string().optional(),
                  sha256: Joi.string().optional(),
                  id: Joi.string().optional(),
                  link: Joi.string().optional(),
                }).optional(),
                document: Joi.object().optional(),
                audio: Joi.object().optional(),
                video: Joi.object().optional(),
                interactive: Joi.object().optional(),
                button: Joi.object().optional(),
              }),
            ).optional(),
            statuses: Joi.array().items(
              Joi.object({
                id: Joi.string().required(),
                status: Joi.string().valid('delivered', 'read', 'failed', 'sent').required(),
                timestamp: Joi.string().required(),
                recipient_id: Joi.string().optional(),
                conversation: Joi.object().optional(),
              }),
            ).optional(),
          }).required(),
          field: Joi.string().required(),
        }),
      ).required(),
      time: Joi.number().optional(),
    }),
  ).required(),
}).unknown(true);

const webhookVerificationSchema = Joi.object({
  'hub.mode': Joi.string().valid('subscribe').required(),
  'hub.challenge': Joi.string().required(),
  'hub.verify_token': Joi.string().required(),
}).unknown(true);

module.exports = {
  webhookPayloadSchema,
  webhookVerificationSchema,
};
