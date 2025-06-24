const db = require('../../config/atmosync');

const getLocations = async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT location, locationid FROM lab_incharge');
        return res.status(200).json(rows);
    } catch (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
    }
};

module.exports = getLocations;