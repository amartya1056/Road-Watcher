import pg from 'pg';

async function testConnection() {
  const connString = "postgresql://postgres:Amartya%241000@db.pnvzmwqyuyylqifaiqux.supabase.co:5432/postgres";
  console.log("Connecting to Supabase...");
  const client = new pg.Client({ connectionString: connString });
  try {
    await client.connect();
    console.log("Connected successfully to Supabase DB!");
  } catch (err) {
    console.error("Connection failed: ", err.message);
  } finally {
    try { await client.end(); } catch(e) {}
  }
}
testConnection();
