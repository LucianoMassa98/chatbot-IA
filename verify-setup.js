#!/usr/bin/env node

/**
 * Setup Verification Script
 * Verifies that the development environment is properly configured
 */

const fs = require('fs');
const path = require('path');

const checks = [];

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

// Check Node.js version
const checkNodeVersion = () => {
  const version = process.version;
  const major = parseInt(version.split('.')[0].substring(1));
  
  if (major >= 16) {
    log.success(`Node.js ${version} installed`);
    return true;
  }
  
  log.error(`Node.js v16+ required, found ${version}`);
  return false;
};

// Check npm installation
const checkNpm = () => {
  try {
    require('child_process').execSync('npm --version');
    log.success('npm installed');
    return true;
  } catch {
    log.error('npm not found');
    return false;
  }
};

// Check required files
const checkRequiredFiles = () => {
  const required = [
    'package.json',
    '.env.example',
    'README.md',
    'src/app.js',
    'src/server.js',
  ];
  
  let allExist = true;
  required.forEach((file) => {
    const exists = fs.existsSync(path.join(__dirname, file));
    if (exists) {
      log.success(`${file} exists`);
    } else {
      log.error(`${file} missing`);
      allExist = false;
    }
  });
  
  return allExist;
};

// Check .env file
const checkEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    log.success('.env file exists');
    return true;
  }
  
  log.warn('.env file not found');
  log.info('Run: cp .env.example .env');
  return false;
};

// Check node_modules
const checkNodeModules = () => {
  const modulesPath = path.join(__dirname, 'node_modules');
  
  if (fs.existsSync(modulesPath)) {
    log.success('node_modules exists');
    return true;
  }
  
  log.warn('node_modules not found');
  log.info('Run: npm install');
  return false;
};

// Check PostgreSQL connection (simple check)
const checkPostgresSetup = () => {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log.warn('Cannot check PostgreSQL without .env');
    return false;
  }
  
  const env = fs.readFileSync(envPath, 'utf8');
  const hasDbConfig = env.includes('DB_HOST') && 
                      env.includes('DB_USER') && 
                      env.includes('DB_NAME');
  
  if (hasDbConfig) {
    log.success('Database configuration exists in .env');
    log.info('Run: npm run migrate (to set up database)');
    return true;
  }
  
  log.warn('Database configuration missing in .env');
  return false;
};

// Check Meta configuration
const checkMetaConfig = () => {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log.warn('Cannot check Meta config without .env');
    return false;
  }
  
  const env = fs.readFileSync(envPath, 'utf8');
  const hasMetaConfig = env.includes('META_VERIFY_TOKEN');
  
  if (hasMetaConfig) {
    log.success('Meta configuration exists in .env');
    log.info('Add META_ACCESS_TOKEN after setting up Meta app');
    return true;
  }
  
  log.warn('Meta configuration missing in .env');
  return false;
};

// Run all checks
const runChecks = () => {
  console.log(`\n${colors.blue}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  Development Setup Verification${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════${colors.reset}\n`);

  checks.push(checkNodeVersion());
  checks.push(checkNpm());
  checks.push(checkRequiredFiles());
  checks.push(checkEnvFile());
  checks.push(checkNodeModules());
  checks.push(checkPostgresSetup());
  checks.push(checkMetaConfig());

  const passed = checks.filter(Boolean).length;
  const total = checks.length;

  console.log(`\n${colors.blue}═══════════════════════════════════${colors.reset}`);
  
  if (passed === total) {
    log.success(`All checks passed (${passed}/${total})`);
    console.log(`\n${colors.green}Setup is complete!${colors.reset}`);
    console.log(`${colors.green}Run: npm run dev${colors.reset}\n`);
    process.exit(0);
  } else {
    log.warn(`${passed}/${total} checks passed`);
    console.log(`\nFix the issues above and run: npm run verify\n`);
    process.exit(1);
  }
};

// Run verification
runChecks();
