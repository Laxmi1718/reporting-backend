const pool = require("./config/database");

async function testConnection() {
  try {
    const connection = await pool.getConnection();

    console.log("✅ MySQL Database Connected Successfully");

    connection.release();
  } catch (error) {
    console.error("❌ Database Connection Failed:", error.message);
  }
}

testConnection();