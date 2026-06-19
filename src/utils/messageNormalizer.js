/**
 * Normalize incoming Meta webhook messages to unified format
 */
const normalizeMessage = (entry, messagingProduct) => {
  const message = {
    userId: null,
    text: null,
    channel: null,
    messageType: 'text',
    externalId: null,
    metadata: {},
  };

  try {
    // Extract messaging product and set channel
    if (messagingProduct === 'whatsapp') {
      message.channel = 'whatsapp';
      message.userId = entry.messages[0].from;
      message.externalId = entry.messages[0].id;

      if (entry.messages[0].type === 'text') {
        message.text = entry.messages[0].text.body;
      } else {
        message.messageType = entry.messages[0].type;
        message.text = `[${entry.messages[0].type} message received]`;
      }

      // Add contact name if available
      if (entry.contacts) {
        message.metadata.contactName = entry.contacts[0].profile.name;
      }

      // Add phone number ID if available
      if (entry.metadata && entry.metadata.phone_number_id) {
        message.metadata.phoneNumberId = entry.metadata.phone_number_id;
      }

    } else if (messagingProduct === 'instagram') {
      message.channel = 'instagram';
      message.userId = entry.messaging[0].sender.id;
      message.externalId = entry.messaging[0].message.mid;

      if (entry.messaging[0].message.text) {
        message.text = entry.messaging[0].message.text;
      } else if (entry.messaging[0].message.attachments) {
        message.messageType = entry.messaging[0].message.attachments[0].type;
        message.text = `[${message.messageType} message received]`;
      }
    } else if (messagingProduct === 'facebook') {
      message.channel = 'messenger';
      message.userId = entry.messaging[0].sender.id;
      message.externalId = entry.messaging[0].message.mid;

      if (entry.messaging[0].message.text) {
        message.text = entry.messaging[0].message.text;
      } else if (entry.messaging[0].message.attachments) {
        message.messageType = entry.messaging[0].message.attachments[0].type;
        message.text = `[${message.messageType} message received]`;
      }
    }

    return message;
  } catch (error) {
    throw new Error(`Failed to normalize message: ${error.message}`);
  }
};

module.exports = {
  normalizeMessage,
};
