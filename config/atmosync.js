const db = require('mysql2');
const atmosync_db_connect = db.createPool({
    host : "localhost",
    user : "root",
    password : "",
    database : "atmosync",
});
module.exports = atmosync_db_connect;
