#!/usr/bin/env node

// Attempt to send Enter key to the controlling terminal
const fs = require('fs');

// Try to write directly to the controlling terminal
try {
  // Get the controlling terminal device
  const tty = fs.openSync('/dev/tty', 'w');

  // Send carriage return (Enter key)
  fs.writeSync(tty, '\r');

  fs.closeSync(tty);
  console.log('Sent Enter key to terminal');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
