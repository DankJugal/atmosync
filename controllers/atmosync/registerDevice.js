const db = require('../../config/atmosync');
const logger = require('../../logger');

const registerDevice = async (req, res) => {
    const plainText = req.body;

    if (!plainText || plainText.length === 0) {
        logger.error('No data received. Device registration aborted.');
        return res.status(400).send('No data provided');
    }

    const parts = plainText.split(' ');
    if (parts.length !== 3) {
        logger.error(`Invalid registration data format. Received: "${plainText}"`);
        return res.status(400).send('Invalid data format');
    }

    const [device_name, device_ip_address, device_mac_address] = parts;

    if (!device_name || !device_ip_address || !device_mac_address) {
        logger.error('Incomplete device data. Registration aborted.');
        return res.status(400).send('Incomplete device data');
    }

    try {
        const FIND_MAC = `SELECT * FROM devices WHERE device_mac_address = ?`;
        const [macRows] = await db.promise().query(FIND_MAC, [device_mac_address]);

        if (macRows.length > 1) {
            logger.warn(`Multiple records found for MAC address ${device_mac_address} (count: ${macRows.length})`);
        }

        const FIND_DEVICE = `SELECT * FROM devices WHERE device_name = ?`;
        const [rows] = await db.promise().query(FIND_DEVICE, [device_name]);

        if (rows.length > 0) {
            const UPDATE_DEVICE = `
                UPDATE devices 
                SET device_ip_address = ?, device_status = 'online', device_last_connected = NOW()
                WHERE device_name = ?`;
            await db.promise().query(UPDATE_DEVICE, [device_ip_address, device_name]);
            logger.info(`Device "${device_name}" updated: IP = ${device_ip_address}, status = online.`);
            return res.status(200).send('');
        } else {
            const INSERT_DEVICE = `
                INSERT INTO devices 
                (device_name, device_ip_address, device_mac_address, device_status, device_last_connected, device_installation_time)
                VALUES (?, ?, ?, 'online', NOW(), NOW())`;
            await db.promise().query(INSERT_DEVICE, [device_name, device_ip_address, device_mac_address]);
            logger.info(`New device registered: Name = "${device_name}", IP = ${device_ip_address}, MAC = ${device_mac_address}`);
            return res.status(201).send('');
        }
    } catch (err) {
        logger.error(`Registration failed for device "${device_name}". DB Error: ${err.message}`);
        return res.status(500).send('Internal server error');
    }
};

module.exports = registerDevice;