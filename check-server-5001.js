const http = require('http');

function checkServer(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/admin/orders/stats',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`✅ Server responding on port ${port}`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 401) {
          console.log('   🔒 Authentication required (expected)');
        } else if (res.statusCode === 404) {
          console.log('   ❌ Endpoint not found');
        } else {
          console.log(`   📄 Response: ${data.substring(0, 200)}...`);
        }
        resolve(true);
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log(`❌ Server not running on port ${port}`);
      } else {
        console.log(`❌ Error connecting to port ${port}: ${err.message}`);
      }
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏰ Timeout connecting to port ${port}`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Checking which port the backend server is running on...\n');

  // Check common ports
  const ports = [5000, 5001, 3000, 8000];
  
  for (const port of ports) {
    console.log(`Checking port ${port}...`);
    const isRunning = await checkServer(port);
    if (isRunning) {
      console.log(`\n🎯 Backend server found on port ${port}!`);
      console.log(`\n📋 Correct API URLs:`);
      console.log(`   📊 Orders Stats: http://localhost:${port}/api/admin/orders/stats`);
      console.log(`   📦 All Orders: http://localhost:${port}/api/admin/orders`);
      console.log(`   🛡️ Escrow Orders: http://localhost:${port}/api/admin/orders/method/escrow`);
      console.log(`   💳 Standard Orders: http://localhost:${port}/api/admin/orders/method/standard`);
      console.log(`   ⭐ Ratings: http://localhost:${port}/api/admin/ratings`);
      console.log(`   🚨 Reports: http://localhost:${port}/api/admin/reports`);
      break;
    }
    console.log('');
  }

  console.log('\n💡 If no server was found, make sure to start the backend server:');
  console.log('   cd backend');
  console.log('   npm start');
  console.log('   # or');
  console.log('   node server.js');
}

main().catch(console.error);
