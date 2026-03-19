const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "egresos_db",
  password: "1997",
  port: 5432,
});

module.exports = pool;