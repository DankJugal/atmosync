const db = require('mysql2');
const hubvolt = db.createPool({
    host : "localhost",
    user : "root",
    password : "6103",
    database : "atmosync",
});
module.exports = atmosync;