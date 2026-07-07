const { User } = require('./src/models');
const logger = require('./src/config/logger');

// Load email from CLI argument
const email = process.argv[2];

if (!email) {
  console.error('\x1b[31mError: Por favor, especifica un email de Google.\x1b[0m');
  console.log('Uso: node register-admin.js <tu-email-de-google@gmail.com>');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Conectando a la base de datos para registrar el email Google: ${email}...`);

    // Check if user already exists with that email in metadata
    const { Op } = require('sequelize');
    let user = await User.findOne({
      where: {
        metadata: { [Op.contains]: { googleEmail: email } }
      }
    });

    if (user) {
      console.log(`El usuario con email ${email} ya existe en el sistema con ID ${user.id}.`);
      console.log(`Actualizando rol a 'administrador' e isActive a true...`);
      user.role = 'administrador';
      user.isActive = true;
      await user.save();
      console.log('\x1b[32m✓ Usuario actualizado exitosamente como administrador.\x1b[0m');
    } else {
      console.log(`No se encontró un usuario con el email ${email}. Creando uno nuevo...`);
      user = await User.create({
        contact: email, // Usamos el email como contacto para este administrador
        channel: 'whatsapp',
        role: 'administrador',
        firstName: email.split('@')[0],
        lastName: 'Admin',
        isActive: true,
        metadata: {
          googleEmail: email
        }
      });
      console.log(`\x1b[32m✓ Usuario creado exitosamente con ID: ${user.id} y rol: ${user.role}.\x1b[0m`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\x1b[31mError al registrar el administrador en la base de datos:\x1b[0m', error.message);
    process.exit(1);
  }
}

run();
