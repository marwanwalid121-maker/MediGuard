const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = 3007;

let currentNgrokUrl = null;
let lastChecked = null;

// Function to get ngrok URL
function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    exec('curl http://localhost:4040/api/tunnels', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
        if (httpsTunnel) {
          resolve(httpsTunnel.public_url);
        } else {
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Check ngrok URL every 5 seconds
setInterval(async () => {
  try {
    const url = await getNgrokUrl();
    if (url && url !== currentNgrokUrl) {
      currentNgrokUrl = url;
      lastChecked = new Date().toISOString();
      console.log(`✅ Ngrok URL updated: ${currentNgrokUrl}`);
    }
  } catch (error) {
    console.error('❌ Failed to get ngrok URL:', error.message);
  }
}, 5000);

// API endpoint to get current ngrok URL
app.get('/api/ngrok-url', (req, res) => {
  res.json({
    success: true,
    url: currentNgrokUrl,
    lastChecked: lastChecked
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ngrok-monitor' });
});

app.listen(PORT, () => {
  console.log(`🔗 Ngrok Monitor running on http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/ngrok-url`);
  console.log(`💡 Monitoring ngrok tunnel changes...`);
});
