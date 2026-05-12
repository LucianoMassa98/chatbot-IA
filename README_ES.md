# Chatbot Multiplataforma - Backend

Un backend completo y listo para producción para chatbots multiplataforma de Meta (WhatsApp, Instagram, Facebook Messenger) construido con arquitectura MVC.

## 📋 Tabla de Contenidos

- [¿Qué es?](#qué-es)
- [Características Principales](#características-principales)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración de Credenciales](#configuración-de-credenciales)
- [Configuración de Meta Developer](#configuración-de-meta-developer)
- [Ejecución](#ejecución)
- [API Endpoints](#api-endpoints)
- [Base de Datos](#base-de-datos)
- [Despliegue](#despliegue)
- [Troubleshooting](#troubleshooting)

---

## ¿Qué es?

Este es un **backend robusto y escalable** para gestionar chatbots en múltiples plataformas de Meta. Implementa una arquitectura MVC limpia con:

- **Soporte Multiplataforma**: WhatsApp, Instagram, Facebook Messenger
- **Flujos de Conversación**: Ventas y Soporte predefinidos
- **Gestión de Sesiones**: Seguimiento del estado de conversación por usuario
- **Base de Datos**: PostgreSQL con Sequelize ORM
- **Validación y Seguridad**: Joi para validación, Helmet para seguridad
- **Logging Completo**: Winston para logs estructurados
- **Listo para Producción**: Docker, migraciones, manejo de errores

---

## Características Principales

### 🔄 Integración con Webhooks
- Endpoint de verificación GET
- Recepción de mensajes POST
- Soporte para todas las plataformas Meta
- Manejo de actualizaciones de estado
- Soporte para archivos adjuntos

### 💬 Flujos de Conversación
- **Flujo de Ventas** (4 pasos): Bienvenida → Interés en Producto → Recolección de Contacto → Confirmación
- **Flujo de Soporte** (5 pasos): Bienvenida → Categorización de Problema → Solución → Escalamiento

### 🗃️ Gestión de Base de Datos
- Usuarios (contacto, canal, metadatos)
- Conversaciones (estado, tema)
- Mensajes (dirección, tipo, contenido)
- Sesiones (flujo, paso, contexto)

### 🔒 Seguridad
- Headers de seguridad con Helmet
- Configuración CORS
- Validación con Joi
- Token de verificación de webhook

---

## Requisitos Previos

### Software Necesario
- **Node.js** v16 o superior ([Descargar](https://nodejs.org/))
- **PostgreSQL** 12 o superior ([Descargar](https://www.postgresql.org/))
- **npm** v8+ o **yarn**

### Cuentas Necesarias
- Cuenta de **Meta Developer**
- Acceso a **WhatsApp Business API**
- Página de **Facebook** para Messenger
- Cuenta de **Instagram** Business

---

## Instalación

### 1. Clonar e Instalar Dependencias

```bash
git clone <repositorio-url>
cd multichannel-chatbot-backend
npm install
```

### 2. Configurar Base de Datos PostgreSQL

```bash
# Abrir CLI de PostgreSQL
psql -U postgres

# Ejecutar estos comandos:
CREATE USER chatbot_user WITH PASSWORD 'tu_contraseña_segura';
CREATE DATABASE chatbot_db OWNER chatbot_user;
GRANT ALL PRIVILEGES ON DATABASE chatbot_db TO chatbot_user;

# Salir
\q
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

```env
# Configuración del Servidor
PORT=3000
NODE_ENV=development

# Configuración de Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_USER=chatbot_user
DB_PASS=tu_contraseña_segura
DB_NAME=chatbot_db

# Configuración de Meta
META_VERIFY_TOKEN=token_verificacion_unico
META_ACCESS_TOKEN=tu_access_token_de_meta

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Configuración de Sesión
SESSION_TIMEOUT=3600

# Configuración AI (opcional)
AI_ENABLED=false
AI_API_KEY=
AI_API_URL=
```

### 4. Ejecutar Migraciones

```bash
npm run migrate
```

### 5. Iniciar Servidor

```bash
# Desarrollo (con auto-recarga)
npm run dev

# Producción
npm start
```

Salida esperada:
```
🚀 Server is running on port 3000
```

---

## Configuración de Credenciales

### 1. Token de Verificación de Meta
- Ve a tu [Meta Developer Dashboard](https://developers.facebook.com/)
- Selecciona tu aplicación
- Ve a WhatsApp → Configuration
- Configura el **Webhook URL** y **Verify Token**
- Usa el mismo token en `META_VERIFY_TOKEN`

### 2. Access Token de Meta
- En Meta Developer Dashboard
- Ve a WhatsApp → API Setup
- Genera un **Permanent Access Token**
- Cóalo en `META_ACCESS_TOKEN`

### 3. Configuración de Plataformas

#### WhatsApp Business API
1. Crea una cuenta de WhatsApp Business
2. Obtén el **Phone Number ID**
3. Configura el webhook en Meta Developer Console

#### Facebook Messenger
1. Crea una página de Facebook
2. Añade el producto Messenger a tu app
3. Configura los permisos necesarios

#### Instagram Messaging
1. Convierte tu cuenta a Instagram Business
2. Añade el producto Instagram a tu app
3. Configura los permisos de mensajería

---

## Configuración de Meta Developer

### Paso 1: Crear Aplicación Meta
1. Ve a [developers.facebook.com](https://developers.facebook.com/)
2. Crea una nueva aplicación
3. Selecciona tipo "Business"

### Paso 2: Configurar Productos
Añade estos productos a tu aplicación:
- **WhatsApp** - Para mensajería WhatsApp
- **Messenger** - Para Facebook Messenger
- **Instagram** - Para Instagram Direct

### Paso 3: Configurar Webhook
1. URL del Webhook: `https://tudominio.com/webhook/meta`
2. Token de Verificación: Usa el mismo que en `.env`
3. Suscríbete a estos campos:
   - `messages`
   - `messaging_postbacks`
   - `message_deliveries`
   - `message_reads`

### Paso 4: Obtener Permisos
Solicita estos permisos:
- `pages_manage_engagement`
- `pages_messaging`
- `instagram_basic`
- `instagram_manage_messages`
- `whatsapp_business_messaging`

### Paso 5: Probar Webhook
Usa ngrok para pruebas locales:
```bash
ngrok http 3000
```

Usa la URL de ngrok en tu webhook temporalmente.

---

## Ejecución

### Comandos Disponibles

```bash
# Desarrollo (con auto-recarga)
npm run dev

# Producción
npm start

# Verificar configuración
npm run verify

# Migraciones
npm run migrate
npm run migrate:undo

# Linting
npm run lint
npm run lint:fix

# Tests
npm test
```

### Verificar Funcionamiento

```bash
# Health check
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"OK","timestamp":"...","environment":"development"}
```

---

## API Endpoints

### Health y Estado
- `GET /` - Endpoint raíz
- `GET /health` - Verificación de salud

### Webhook
- `GET /webhook/meta` - Verificación de webhook
- `POST /webhook/meta` - Recepción de mensajes

### Ejemplo de Uso

```bash
# Verificar webhook
curl "https://tudominio.com/webhook/meta?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=CHALLENGE"

# Enviar mensaje (ejemplo)
curl -X POST https://tudominio.com/webhook/meta \
  -H "Content-Type: application/json" \
  -d '{"object":"page","entry":[{"id":"PAGE_ID","messaging":[{"sender":{"id":"USER_ID"},"message":{"text":"Hola"}}]}]}'
```

---

## Base de Datos

### Esquema de Tablas

#### Users
- `id` (UUID, Primary Key)
- `contact` (String, indexed)
- `channel` (ENUM: whatsapp, messenger, instagram)
- `firstName`, `lastName`
- `metadata` (JSONB)
- `isActive` (Boolean)

#### Conversations
- `id` (UUID, Primary Key)
- `userId` (Foreign Key)
- `status` (ENUM: active, closed, archived)
- `topic` (String)
- `metadata` (JSONB)

#### Messages
- `id` (UUID, Primary Key)
- `conversationId` (Foreign Key)
- `direction` (ENUM: in/out)
- `content` (TEXT)
- `messageType` (ENUM: text, image, audio, video)
- `externalId` (String)
- `metadata` (JSONB)

#### Sessions
- `id` (UUID, Primary Key)
- `userId` (Foreign Key, unique)
- `currentFlow` (ENUM: sales, support)
- `flowStep` (Integer)
- `context` (JSONB)
- `expiresAt` (Timestamp)
- `isActive` (Boolean)

### Migraciones

```bash
# Crear nueva migración
npx sequelize-cli migration:generate --name nombre_migracion

# Ejecutar migraciones
npm run migrate

# Deshacer última migración
npm run migrate:undo
```

---

## Despliegue

### Docker

```bash
# Construir y ejecutar con Docker Compose
docker-compose up --build

# Detener
docker-compose down
```

### Heroku

```bash
# Instalar Heroku CLI
heroku create tu-app-name

# Configurar variables de entorno
heroku config:set NODE_ENV=production
heroku config:set DB_HOST=...
heroku config:set META_ACCESS_TOKEN=...

# Desplegar
git push heroku main
```

### AWS EC2

1. Lanza una instancia EC2 con Ubuntu
2. Instala Node.js y PostgreSQL
3. Clona el repositorio
4. Configura nginx como reverse proxy
5. Configura SSL con Let's Encrypt
6. Ejecuta la aplicación con PM2

---

## Troubleshooting

### Errores Comunes

**Error de conexión a base de datos:**
```bash
# Verificar PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar credenciales en .env
cat .env
```

**Webhook no recibe mensajes:**
```bash
# Usar ngrok para pruebas
ngrok http 3000

# Actualizar webhook URL en Meta Developer Console
```

**Puerto 3000 en uso:**
```bash
# Usar puerto diferente
PORT=3001 npm run dev
```

### Logs

```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Logs de errores
tail -f logs/error.log
```

### Depuración

```bash
# Modo debug
NODE_ENV=development DEBUG=* npm run dev

# Verificar configuración
npm run verify
```

---

## Estructura del Proyecto

```
src/
├── app.js                 # Inicialización Express
├── server.js              # Inicio del servidor
├── config/                # Configuración
│   ├── database.js        # Configuración PostgreSQL
│   ├── env.js            # Variables de entorno
│   └── logger.js         # Configuración Winston
├── controllers/           # Controladores HTTP
│   └── webhookController.js
├── services/              # Lógica de negocio
│   ├── messageService.js  # Orquestador principal
│   ├── sessionService.js  # Gestión de sesiones
│   ├── flowService.js     # Ejecución de flujos
│   ├── aiService.js       # Respuestas AI
│   └── metaService.js     # API de Meta
├── models/                # Modelos Sequelize
│   ├── index.js
│   ├── User.js
│   ├── Conversation.js
│   ├── Message.js
│   └── Session.js
├── routes/                # Definición de rutas
│   └── webhookRoutes.js
├── middleware/            # Middleware Express
│   ├── errorHandler.js
│   └── validation.js
├── schemas/               # Schemas Joi
│   └── webhookSchema.js
└── utils/                 # Utilidades
    ├── AppError.js
    ├── messageNormalizer.js
    └── constants.js
```

---

## Contribuir

1. Fork el proyecto
2. Crea una feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## Licencia

MIT License - ver archivo LICENSE para detalles.

---

## Soporte

Para ayuda adicional:
- Revisa la documentación completa en `README.md` (inglés)
- Revisa ejemplos en `API_EXAMPLES.js`
- Revisa arquitectura en `ARCHITECTURE.md`

---

**¡Listo para usar! 🚀**

Este chatbot está completamente funcional y listo para producción con las credenciales y configuración adecuadas.
