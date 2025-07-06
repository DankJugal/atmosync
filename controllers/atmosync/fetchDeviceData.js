const db = require('../../config/atmosync');
const { format } = require('date-fns');
const logger = require('../../logger');

exports.fetchDeviceData = (req, res) => {
  const { device_name, offset, date } = req.params;

  const validOffsets = [1, 2, 5];
  const parsedOffset = parseInt(offset);
  if (!validOffsets.includes(parsedOffset)) {
    return res.status(400).json({ error: 'Invalid offset value. Use 1, 2 or 5' });
  }

  const requestedDate = new Date(date);
  if (isNaN(requestedDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const startOfDayStr = `${date} 00:00:00`;
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  let endOfDayStr = (date === todayStr)
    ? format(now, 'yyyy-MM-dd HH:mm:ss')
    : `${date} 23:59:59`;

  const query = `
    SELECT * FROM readings 
    WHERE device_name = ? 
      AND timestamp BETWEEN ? AND ? 
    ORDER BY timestamp ASC
  `;

  db.query(query, [device_name, startOfDayStr, endOfDayStr], (err, results) => {
    if (err) {
      logger.error(`[SERVER_ERROR] DB Query Failed: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!results.length) {
      return res.status(404).json({ error: 'No readings found for this device on the given date.' });
    }

    const filtered = [];
    let lastTime = null;

    for (const r of results) {
      const current = new Date(r.timestamp);
      if (!lastTime || (current - lastTime) >= parsedOffset * 60 * 1000) {
        filtered.push(r);
        lastTime = current;
      }
    }

    logger.info(`[FETCH_SUCCESS] ${device_name} | ${filtered.length} readings returned for ${date}`);

    return res.status(200).json({
      device: device_name,
      date,
      offset: parsedOffset,
      from: startOfDayStr,
      to: endOfDayStr,
      total_readings: filtered.length,
      readings: filtered
    });
  });
};
