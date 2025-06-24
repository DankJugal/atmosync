const db = require('../../config/atmosync');

const getDevices = async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT * FROM devices');
        return res.status(200).json(rows);
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
    }
};

module.exports = getDevices;