const express = require('express');
const router = express.Router();

const registerDevice = require('../controllers/atmosync/registerDevice');
const {fetchDeviceData} = require('../controllers/atmosync/fetchDeviceData');
router.post('/register', registerDevice);
router.get('/fetch/:device_name/:offset/:date', fetchDeviceData);

module.exports = router;