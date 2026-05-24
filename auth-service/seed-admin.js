const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importa tu modelo de Usuario (ajusta la ruta según tu estructura)
// Si no tienes el modelo definido, este script asume la estructura estándar
const userSchema = new mongoose.Schema({
    id_usuario: { type: Number, unique: true },
    nombre: String,
    apellido: String,
    email: { type: String, unique: true },
    password: { type: String },
    rol: { type: String, default: 'comprador' }
});

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', userSchema);

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB para seeding...');

        const hashedPassword = await bcrypt.hash('admin123456', 10);

        const adminData = {
            id_usuario: 0, // ID inicial para admin
            nombre: 'Admin',
            apellido: 'Sistema',
            email: 'admin@emprendemarket.com',
            password: hashedPassword,
            rol: 'administrador'
        };

        await Usuario.findOneAndUpdate({ email: adminData.email }, adminData, { upsert: true });
        console.log('Usuario administrador creado/actualizado con éxito');
        process.exit(0);
    } catch (err) {
        console.error('Error en el seeding:', err);
        process.exit(1);
    }
}

seedAdmin();