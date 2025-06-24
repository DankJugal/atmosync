const db = require('mysql2');
const atmosync = db.createPool({
    host : "localhost",
    user : "root",
    password : "6103",
    database : "atmosync",
});
module.exports = atmosync;