const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;
const atmosync = require('./router/atmosync');
const db = require('./config/atmosync');
app.use(express.json());
app.use(express.text());

app.use('/atmosync', atmosync);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const echoAllDevices = async () => {
  const DEVICE_QUERY = `SELECT device_name, device_ip_address FROM devices`;

  db.query(DEVICE_QUERY, async (err, results) => {
    if (err || !results || results.length === 0) {
      console.error('Error fetching devices or no devices found:', err || 'Empty list');
      return;
    }

    const promises = results.map((device) => {
      return axios.post(
        `http://${device.device_ip_address}/`,
        'ECHO XYZ',
        { headers: { 'Content-Type': 'text/plain' }, timeout: 10000 }
      )
      .then((response) => {
        if (!response.data) {
          const UPDATE_QUERY = `UPDATE devices SET device_status = 'offline', device_last_connected = NOW() WHERE device_name = ?`;
          db.query(UPDATE_QUERY, [device.device_name]);
          console.log(`No response from ${device.device_name}`);
        } else {
          console.log(`Echo from ${device.device_name}:`, response.data);
        }
      })
      .catch((err) => {
        const UPDATE_QUERY = `UPDATE devices SET device_status = 'offline', device_last_connected = NOW() WHERE device_name = ?`;
        db.query(UPDATE_QUERY, [device.device_name]);
        console.error(`Error with ${device.device_name}:`, err.message);
      });
    });

    await Promise.allSettled(promises); 
  });
};

setInterval(echoAllDevices, 60000);
