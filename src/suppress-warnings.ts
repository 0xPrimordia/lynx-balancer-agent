#!/usr/bin/env node

/**
 * Utility to suppress noisy warnings and errors from dependencies
 * This helps keep the demo output clean and focused
 */

// Suppress Zod deprecation warnings from Hedera Agent Kit
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress Zod deprecation warnings
  if (message.includes('Zod field') && message.includes('.optional()')) {
    return;
  }
  
  // Suppress invalid topic ID format errors (these are internal parsing issues)
  if (message.includes('Invalid connection topic ID format') ||
      message.includes('Invalid connection topic ID format:')) {
    return;
  }
  
  // Suppress other noisy warnings
  if (message.includes('ModelCapabilityDetector: Loaded')) {
    return;
  }
  
  originalWarn(...args);
};

// Suppress specific error messages that are not critical
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress invalid topic ID format errors
  if (message.includes('Invalid connection topic ID format') ||
      message.includes('Invalid connection topic ID format:')) {
    return;
  }
  
  // Suppress other non-critical errors
  if (message.includes('Failed to send message to connection')) {
    return;
  }
  
  originalError(...args);
};

// Suppress INFO level logs that are too verbose
const originalInfo = console.info;
console.info = (...args: any[]) => {
  const message = args.join(' ');
  
  // Suppress verbose HCS-11 and ServiceBuilder logs
  if (message.includes('Fetching profile for account') ||
      message.includes('Getting account memo') ||
      message.includes('Got account memo') ||
      message.includes('Found HCS-11 memo') ||
      message.includes('Retrieving profile from Kiloscribe CDN') ||
      message.includes('Checking messages for connection') ||
      message.includes('Message submitted successfully') ||
      message.includes('Submitted connection request')) {
    return;
  }
  
  originalInfo(...args);
};

export {}; 