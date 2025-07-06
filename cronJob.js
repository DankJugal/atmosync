const cron = require('node-cron');
const db = require('./config/atmosync');
const logger = require('./logger');

cron.schedule('0 0 * * *', async () => {
    try {
        const DELETE_QUERY = `
            DELETE FROM readings
            WHERE timestamp < NOW() - INTERVAL 3 MONTH
        `;
        const [result] = await db.promise().query(DELETE_QUERY);
        logger.info(`[CRON] Deleted ${result.affectedRows} old readings.`);
    } catch (error) {
        logger.error(`[CRON] Error during cleanup: ${error.message}`);
    }
});
