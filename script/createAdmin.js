const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@igsaa.edu.ng' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      email: 'admin@igsaa.edu.ng',
      password: 'Admin@123', // Change this immediately after first login
      fullName: 'System Administrator',
      role: 'admin',
      permissions: ['read_forms', 'write_forms', 'delete_forms', 'manage_users'],
      isActive: true
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@igsaa.edu.ng');
    console.log('Password: Admin@123');
    console.log('\n⚠️ IMPORTANT: Change the password immediately after first login!');
    
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    process.exit(0);
  }
}

createAdmin();