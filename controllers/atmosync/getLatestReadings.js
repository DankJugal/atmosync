const db = require('../../config/atmosync'); // Adjust the path if needed

// Utility function: Format DATETIME to "YYYY-MM-DD HH:MM"
function formatDateTime(dt) {
  const date = new Date(dt);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

const getLatestReadings = async (req, res) => {
  const query = `
    SELECT 
      d.device_name AS name,
      d.device_mac_address AS mac,
      d.device_ip_address AS ip,
      d.device_status AS status,
      d.device_installation_time AS installTime,
      d.device_last_connected AS lastConnected,
      d.device_call_frequency,
      d.device_location_id,
      r.device_temperature AS temperature,
      r.device_humidity AS humidity
    FROM devices d
    LEFT JOIN (
      SELECT r1.*
      FROM readings r1
      INNER JOIN (
        SELECT device_name, MAX(timestamp) AS max_time
        FROM readings
        GROUP BY device_name
      ) r2 ON r1.device_name = r2.device_name AND r1.timestamp = r2.max_time
    ) r ON d.device_name = r.device_name
  `;

  try {
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching latest device data:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const formatted = results.map((row, index) => ({
        id: index + 1,
        name: row.name,
        mac: row.mac,
        ip: row.ip,
        temperature: parseFloat(row.temperature || 0).toFixed(1),
        humidity: parseFloat(row.humidity || 0).toFixed(1),
        status: row.status === 'online' ? 'active' : 'inactive',
        installTime: row.installTime ? formatDateTime(row.installTime) : 'N/A',
        lastConnected: row.lastConnected ? formatDateTime(row.lastConnected) : 'N/A',

        device_call_frequency: row.device_call_frequency,
        device_location_id: row.device_location_id
      }));

      res.json(formatted);
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = getLatestReadings;
