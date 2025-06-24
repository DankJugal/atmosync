const db = require('../../config/atmosync');

const deleteDevice = async (req, res) => {
    const deviceName = req.params.device_name;

    try {
        const [result] = await db.promise().query(
            'DELETE FROM devices WHERE device_name = ?',
            [deviceName]
        );

        if (result.affectedRows === 0) {
            return res.status(404).send('Device not found');
        }

        return res.status(200).send('Device deleted successfully');
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
    }
};

module.exports = deleteDevice;