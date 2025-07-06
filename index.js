const express = require('express');
const axios = require('axios');
const db = require('./config/atmosync');
const router = require('./router/atmosync');
const cors = require('cors');
const moment = require('moment-timezone');
const logger = require('./logger');
const readinglogger = require('./readinglogger');
require('./cronJob');

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.text());
app.use(cors());
app.use('/atmosync', router);

app.listen(PORT, () => {
  logger.info(`Server started and listening on port ${PORT}`);
});

// --- Echo Function ---
const echoAllDevices = async () => {
  // Step 1: Echo ONLINE devices
  db.query(`SELECT device_name, device_ip_address FROM devices WHERE device_status = 'online'`, (err, devicesOnline) => {
    if (err) return logger.error('Error fetching online devices:', err);

    devicesOnline.forEach(async (device) => {
      try {
        const res = await axios.post(`http://${device.device_ip_address}/`, 'ECHO XYZ', {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 5000,
        });

        if (res.data && typeof res.data === 'string') {
          db.query(`UPDATE devices SET device_status = 'online' WHERE device_name = ?`, [device.device_name]);
        } else {
          throw new Error('Invalid response');
        }
      } catch (err) {
        db.query(
          `UPDATE devices SET device_status = 'offline', device_last_connected = NOW()
           WHERE device_name = ? AND device_status != 'offline'`,
          [device.device_name],
          (updateErr, result) => {
            if (updateErr) logger.error(`Error updating offline status for ${device.device_name}:`, updateErr);
            else if (result.affectedRows > 0) {
              logger.warn(`Device ${device.device_name} marked offline`);
            }
          }
        );
      }
    });
  });

  // Step 2: Echo OFFLINE devices to see if any came back
  db.query(`SELECT device_name, device_ip_address FROM devices WHERE device_status = 'offline'`, (err, devicesOffline) => {
    if (err) return logger.error('Error fetching offline devices:', err);

    devicesOffline.forEach(async (device) => {
      try {
        const res = await axios.post(`http://${device.device_ip_address}/`, 'ECHO XYZ', {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 5000,
        });

        if (res.data && typeof res.data === 'string') {
          db.query(
            `UPDATE devices SET device_status = 'online' WHERE device_name = ? AND device_status != 'online'`,
            [device.device_name],
            (updateErr, result) => {
              if (updateErr) logger.error(`Error updating status to online for ${device.device_name}:`, updateErr);
              else if (result.affectedRows > 0) {
                logger.info(`Device ${device.device_name} came back online`);
              }
            }
          );
        }
      } catch (err) {
        // No need to log repeated offline failures here
      }
    });
  });
};

setInterval(echoAllDevices, 300000); // every 5 minutes

// --- Sensor Watcher Map ---
const sensorWatcherMap = new Map(); // device_name -> { intervalId, frequency }

const startSensorWatcher = (device) => {
  const { device_name, device_ip_address, device_call_frequency } = device;
  const frequencyMs = device_call_frequency * 1000;
  let failureCount = 0;
  let isRunning = false;

  const tryReadSensorData = async () => {
    return new Promise((resolve) => {
      db.query(`SELECT device_status FROM devices WHERE device_name = ?`, [device_name], async (err, results) => {
        if (err || !results.length || results[0].device_status !== 'online') {
          const watcher = sensorWatcherMap.get(device_name);
          if (watcher) {
            clearInterval(watcher.intervalId);
            sensorWatcherMap.delete(device_name);
            logger.warn(`Watcher for ${device_name} stopped: device is offline`);
          }
          return resolve(false);
        }

        // Proceed to read sensor data
        const mysqlDatetime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
        const unixTimestamp = Math.floor(Date.now() / 1000);
        const payload = `SENSE ${unixTimestamp}`;

        try {
          const response = await axios.post(`http://${device_ip_address}/`, payload, {
            headers: { 'Content-Type': 'text/plain' },
            timeout: 10000,
          });

          const data = response.data.trim();
          const match = data.match(/^(\S+)\s+(\d+)\s*([\d.]+)C\s*([\d.]+)%RH/);
          if (!match) throw new Error(`Invalid response format: ${data}`);

          const [, receivedDeviceName, , temperature, humidity] = match;

          db.query(
            `INSERT INTO readings (device_name, device_temperature, device_humidity, timestamp) VALUES (?, ?, ?, ?)`,
            [receivedDeviceName, temperature, humidity, mysqlDatetime],
            (err) => {
              if (err) logger.error(`Insert error for ${receivedDeviceName}:`, err);
              else readinglogger.info(`${receivedDeviceName} | Temperature: ${temperature}, Humidity: ${humidity}`);
            }
          );
          resolve(true);
        } catch (err) {
          logger.warn(`Reading failed for ${device_name}: ${err.message}`);
          resolve(false);
        }
      });
    });
  };

  const intervalId = setInterval(async () => {
    if (isRunning) return; // prevent concurrent runs
    isRunning = true;

    const success = await tryReadSensorData();

    if (success) {
      failureCount = 0;
    } else {
      failureCount++;
      if (failureCount >= 2) {
        db.query(
          `UPDATE devices SET device_status = 'offline', device_last_connected = NOW()
           WHERE device_name = ? AND device_status != 'offline'`,
          [device_name],
          (err, result) => {
            if (err) logger.error(`Error marking ${device_name} offline:`, err);
            else if (result.affectedRows > 0) {
              logger.warn(`Device ${device_name} marked offline after 2 failed attempts`);
            }
          }
        );
        clearInterval(intervalId);
        sensorWatcherMap.delete(device_name);
        logger.warn(`Stopped sensor watcher for ${device_name}`);
      }
    }

    isRunning = false; // release lock
  }, frequencyMs);

  sensorWatcherMap.set(device_name, { intervalId, frequency: device_call_frequency });
};

const syncSensorWatchers = () => {
  const DEVICE_QUERY = `
    SELECT device_name, device_ip_address, device_call_frequency
    FROM devices
    WHERE device_ip_address IS NOT NULL AND device_status = 'online'
  `;

  db.query(DEVICE_QUERY, (err, devices) => {
    if (err) {
      logger.error('Error fetching devices for watcher sync:', err);
      return;
    }

    const activeDeviceNames = new Set();

    devices.forEach(device => {
      const { device_name, device_call_frequency } = device;
      activeDeviceNames.add(device_name);

      if (!sensorWatcherMap.has(device_name)) {
        logger.info(`Starting sensor watcher for ${device_name}`);
        startSensorWatcher(device);
      } else {
        const { intervalId, frequency } = sensorWatcherMap.get(device_name);
        if (frequency !== device_call_frequency) {
          logger.info(`Updating sensor watcher for ${device_name}: ${frequency}s → ${device_call_frequency}s`);
          clearInterval(intervalId);
          sensorWatcherMap.delete(device_name);
          startSensorWatcher(device);
        }
      }
    });

    for (const name of sensorWatcherMap.keys()) {
      if (!activeDeviceNames.has(name)) {
        const { intervalId } = sensorWatcherMap.get(name);
        clearInterval(intervalId);
        sensorWatcherMap.delete(name);
        logger.warn(`Stopped sensor watcher for ${name} (offline or removed)`);
      }
    }
  });
};

syncSensorWatchers();
setInterval(syncSensorWatchers, 60000); // every 60s
