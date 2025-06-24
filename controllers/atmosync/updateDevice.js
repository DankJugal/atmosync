const db = require('../../config/atmosync').promise();

const updateDevice = async (req, res) => {
  const { device_call_frequency, device_location_id } = req.body;
  const { device_name } = req.params;

  if (!device_name || device_call_frequency === undefined || device_location_id === undefined) {
    console.warn('Missing required fields:', { device_name, device_call_frequency, device_location_id });
    return res.status(400).json({
      error: 'device_name (in URL), device_call_frequency, and device_location_id are required.'
    });
  }

  try {
    console.log(`Attempting to update device '${device_name}' with frequency=${device_call_frequency}, location_id=${device_location_id}`);

    const [locationRows] = await db.execute(
      'SELECT locationid FROM lab_incharge WHERE locationid = ?',
      [device_location_id]
    );

    if (locationRows.length === 0) {
      console.warn(`Invalid location ID: ${device_location_id}`);
      return res.status(400).json({ error: 'Invalid device_location_id.' });
    }

    const [result] = await db.execute(
      `UPDATE devices
       SET device_call_frequency = ?, device_location_id = ?
       WHERE device_name = ?`,
      [device_call_frequency, device_location_id, device_name]
    );

    if (result.affectedRows === 0) {
      console.warn(`No update performed. Device '${device_name}' may not exist or values were the same.`);
      return res.status(404).json({ error: 'Device not found or no values changed.' });
    }

    console.log(`Device '${device_name}' updated successfully.`);
    res.json({ message: 'Device updated successfully.' });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = updateDevice;
