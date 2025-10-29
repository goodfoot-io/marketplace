const { chromium } = require('playwright');

async function testPermission(permission) {
  console.log(`Testing permission: ${permission}`);
  try {
    const browser = await chromium.launchPersistentContext('/tmp/test-profile-' + permission, {
      headless: true,
      permissions: [permission],
      executablePath: '/home/node/.cache/ms-playwright/chromium-1181/chrome-linux/chrome'
    });
    console.log(`✓ ${permission} is VALID`);
    await browser.close();
    return true;
  } catch (error) {
    console.log(`✗ ${permission} is INVALID - ${error.message}`);
    return false;
  }
}

async function main() {
  const permissions = [
    'geolocation',
    'microphone', 
    'camera',
    'notifications',
    'clipboard-read',
    'clipboard-write',
    'midi',
    'midi-sysex',
    'idle-detection',
    'payment-handler',
    'background-sync',
    'ambient-light-sensor',
    'accelerometer',
    'gyroscope',
    'magnetometer',
    'accessibility-events'
  ];

  const results = { valid: [], invalid: [] };
  
  for (const permission of permissions) {
    const isValid = await testPermission(permission);
    if (isValid) {
      results.valid.push(permission);
    } else {
      results.invalid.push(permission);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Valid permissions:', results.valid);
  console.log('Invalid permissions:', results.invalid);
}

main().catch(console.error);