#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 5 Start Clips Backend Setup\n');

const questions = [
  {
    name: 'port',
    question: 'Enter server port (default: 5000): ',
    default: '5000'
  },
  {
    name: 'frontendUrl',
    question: 'Enter frontend URL (default: http://localhost:5173): ',
    default: 'http://localhost:5173'
  },
  {
    name: 'jwtSecret',
    question: 'Enter JWT secret (default: your_super_secret_jwt_key): ',
    default: 'your_super_secret_jwt_key_change_this_in_production'
  },
  {
    name: 'email',
    question: 'Enter admin email for notifications: ',
    default: 'admin@digitalservices.com'
  }
];

const answers = {};

function askQuestion(index) {
  if (index >= questions.length) {
    createEnvFile();
    installDependencies();
    return;
  }

  const q = questions[index];
  rl.question(q.question, (answer) => {
    answers[q.name] = answer || q.default;
    askQuestion(index + 1);
  });
}

function createEnvFile() {
  const envContent = `
# Server Configuration
PORT=${answers.port}
NODE_ENV=development
FRONTEND_URL=${answers.frontendUrl}

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/digital_services

# JWT Configuration
JWT_SECRET=${answers.jwtSecret}
JWT_EXPIRE=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=${answers.email}
EMAIL_PASS=your_app_specific_password

# App Configuration
APP_NAME=DigitalServices
APP_URL=http://localhost:${answers.port}

# Admin Default Credentials
ADMIN_EMAIL=admin@digitalservices.com
ADMIN_PASSWORD=admin123
`;

  fs.writeFileSync('.env', envContent.trim());
  console.log('\n✅ Created .env file');
}

function installDependencies() {
  console.log('\n📦 Installing dependencies...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
    
    console.log('\n📊 Setting up database...');
    console.log('Please make sure MongoDB is running on mongodb://localhost:27017');
    console.log('\nTo start MongoDB locally:');
    console.log('  For macOS: brew services start mongodb-community');
    console.log('  For Ubuntu: sudo systemctl start mongod');
    console.log('  For Windows: run "mongod" from command prompt');
    
    console.log('\n🎯 Setup complete! Next steps:');
    console.log('1. Start MongoDB');
    console.log('2. Run: npm run seed (to seed the database)');
    console.log('3. Run: npm run dev (to start the server)');
    console.log('\n📝 API will be available at: http://localhost:' + answers.port);
    
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
  }
  
  rl.close();
}

// Check if .env already exists
if (fs.existsSync('.env')) {
  rl.question('.env file already exists. Overwrite? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      askQuestion(0);
    } else {
      console.log('Setup cancelled.');
      rl.close();
    }
  });
} else {
  askQuestion(0);
}