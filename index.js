const express = require('express');
const axios = require('axios');
const db = require('./config/atmosync'); // MySQL connection
const router = require('./router/atmosync'); // API routes
const app = express();
const PORT = 4000;
const cors = require('cors');

app.use(express.json());
app.use(express.text());
app.use(cors());
app.use('/atmosync', router); 

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Track active polling intervals
const pollingMap = new Map(); // device_name -> { intervalId, frequency }

const pollDevice = (device) => {
  const { device_name, device_ip_address, device_call_frequency } = device;
  const frequencyMs = device_call_frequency * 1000;

  const intervalId = setInterval(async () => {
    const unixTimestamp = Math.floor(Date.now() / 1000);
    const mysqlDatetime = new Date(unixTimestamp * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const payload = `SENSE ${unixTimestamp}`;

    try {
      const response = await axios.post(`http://${device_ip_address}/`, payload, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000,
      });

      const data = response.data.trim();
      const match = data.match(/^(\S+)\s+(\d+)\s+Temp:\s*([\d.]+)\s+Humidity:\s*([\d.]+)/);

      if (!match) {
        console.error(`Invalid response from ${device_name}: ${data}`);
        return;
      }

      const [, receivedDeviceName, sentTimestamp, temperature, humidity] = match;

      const INSERT_QUERY = `
        INSERT INTO readings (device_name, device_temperature, device_humidity, timestamp)
        VALUES (?, ?, ?, ?)
      `;

      db.query(INSERT_QUERY, [receivedDeviceName, temperature, humidity, mysqlDatetime], (err) => {
        if (err) {
          console.error(`DB Insert Error for ${receivedDeviceName}:`, err);
        } else {
          console.log(`${receivedDeviceName} | Temp: ${temperature}, Hum: ${humidity}, Time: ${mysqlDatetime}`);
        }
      });

      const UPDATE_QUERY = `
        UPDATE devices SET device_status = 'online', device_last_connected = NOW()
        WHERE device_name = ?
      `;
      db.query(UPDATE_QUERY, [device_name]);

    } catch (err) {
      console.error(`Error polling ${device_name}: ${err.message}`);
      const UPDATE_QUERY = `
        UPDATE devices SET device_status = 'offline', device_last_connected = NOW()
        WHERE device_name = ?
      `;
      db.query(UPDATE_QUERY, [device_name]);
    }

  }, frequencyMs);

  pollingMap.set(device_name, { intervalId, frequency: device_call_frequency });
};

const syncDevicePolling = () => {
  const DEVICE_QUERY = `
    SELECT device_name, device_ip_address, device_call_frequency
    FROM devices
    WHERE device_ip_address IS NOT NULL
  `;

  db.query(DEVICE_QUERY, (err, devices) => {
    if (err) {
      console.error('Error fetching devices:', err);
      return;
    }

    devices.forEach(device => {
      const { device_name, device_call_frequency } = device;

      if (!pollingMap.has(device_name)) {
        // First-time device, start polling
        console.log(`Starting polling for ${device_name} at ${device_call_frequency}s`);
        pollDevice(device);
      } else {
        const { intervalId, frequency } = pollingMap.get(device_name);

        if (frequency !== device_call_frequency) {
          // Frequency changed, restart interval
          console.log(`Updating polling interval for ${device_name}: ${frequency}s → ${device_call_frequency}s`);
          clearInterval(intervalId);
          pollingMap.delete(device_name);
          pollDevice(device);
        }
      }
    });

    // Stop polling for devices removed from DB
    for (const name of pollingMap.keys()) {
      if (!devices.find(d => d.device_name === name)) {
        const { intervalId } = pollingMap.get(name);
        console.log(`Stopping polling for deleted device ${name}`);
        clearInterval(intervalId);
        pollingMap.delete(name);
      }
    }
  });
};

// Run initial sync
syncDevicePolling();

// Resync every 60 seconds to adapt to DB changes
setInterval(syncDevicePolling, 60000);
