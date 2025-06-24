const express = require('express');
const router = express.Router();

const getDevices = require('../controllers/atmosync/getDevice');
const updateDevice = require('../controllers/atmosync/updateDevice');
const deleteDevice = require('../controllers/atmosync/deleteDevice');
const registerDevice = require('../controllers/atmosync/registerDevice');
const getLocations = require('../controllers/atmosync/getLocations');
const getLatestReadings = require('../controllers/atmosync/getLatestReadings');

router.post('/register', registerDevice);
router.get('/devices', getDevices);
router.put('/update/:device_name', updateDevice);
router.delete('/delete/:device_name', deleteDevice);
router.get('/locations', getLocations);
router.get('/devices/latest', getLatestReadings);

module.exports = router;
