const db = require('../../config/atmosync');

const registerDevice = async (req, res) => {
    // Ensure the request body is in plain text format
    const plainText = req.body;
    if (!plainText || plainText.length === 0) {
        return res.status(400).send('No data provided');
    }

    // Split the plain text into parts
    const parts = plainText.split(' ');
    if (parts.length != 3) {
        return res.status(400).send('Invalid data format');
    }

    // Extract device information
    const device_name = parts[0];
    const device_ip_address = parts[1];
    const device_mac_address = parts[2];

    // Validate required fields
    if (!device_name || !device_ip_address || !device_mac_address) {
        return res.status(400).send('Missing required fields');
    }
    try {
        // Check if the device already exists in the database
        const FIND_DEVICE = `SELECT * FROM devices WHERE device_name = ?`;
        const [rows] = await db.promise().query(FIND_DEVICE, [device_name]);

        //update the existing device with new IP Address and Status and last_connected_time
        if (rows.length > 0) {
            const UPDATE_DEVICE = `UPDATE devices SET device_ip_address = ?, device_status = 'online', device_last_connected = NOW() WHERE device_name = ?`;
            await db.promise().query(UPDATE_DEVICE, [device_ip_address, device_name]);
            return res.status(200).send('Device updated successfully');
        } else {
            // device_last_connected implies the last time the device hit /registerDevice endpoint 
            const INSERT_DEVICE = `INSERT INTO devices (device_name, device_ip_address, device_mac_address, device_status, device_last_connected, device_installation_time) VALUES (?, ?, ?, ?, NOW(), NOW())`;
            await db.promise().query(INSERT_DEVICE, [device_name, device_ip_address, device_mac_address, 'online']);
            return res.status(201).send('Device registered successfully');
        }
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
    }
};

module.exports = registerDevice;