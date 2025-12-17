#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const backupDatabase = async () => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    
    // Create backup directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });
    
    console.log('📦 Starting database backup...');
    
    // Use mongodump for backup
    const mongodbUri = process.env.MONGODB_URI;
    const { stdout, stderr } = await execPromise(
      `mongodump --uri="${mongodbUri}" --out="${backupPath}"`
    );
    
    if (stderr && !stderr.includes('writing')) {
      console.error('❌ Backup failed:', stderr);
      return;
    }
    
    console.log('✅ Backup completed successfully!');
    console.log(`📁 Backup location: ${backupPath}`);
    
    // Create a compressed archive
    const { stdout: tarStdout } = await execPromise(
      `tar -czf "${backupPath}.tar.gz" -C "${backupDir}" "backup-${timestamp}"`
    );
    
    // Remove uncompressed backup
    await fs.rm(backupPath, { recursive: true, force: true });
    
    console.log(`📦 Compressed backup: ${backupPath}.tar.gz`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
  }
};

backupDatabase();