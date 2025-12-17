#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const createAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    rl.question('Enter admin email: ', async (email) => {
      rl.question('Enter admin name: ', async (name) => {
        rl.question('Enter admin password: ', async (password) => {
          rl.close();
          
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, 10);
          
          const admin = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'admin',
            isVerified: true,
            isActive: true
          });
          
          console.log(`✅ Admin user created successfully!`);
          console.log(`📧 Email: ${admin.email}`);
          console.log(`👤 Name: ${admin.name}`);
          console.log(`🔑 Password: ${password}`);
          
          await mongoose.disconnect();
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();