import pg from 'pg';

async function tryConnect(connString) {
  const client = new pg.Client({ connectionString: connString });
  try {
    await client.connect();
    const res = await client.query("SELECT datname FROM pg_database WHERE datname='roadwatcher'");
    if (res.rows.length === 0) {
      await client.query("CREATE DATABASE roadwatcher");
      console.log(`Successfully connected and created roadwatcher using: ${connString}`);
    } else {
      console.log(`Successfully connected. roadwatcher exists using: ${connString}`);
    }
    return true;
  } catch (err) {
    return false;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

async function setup() {
  const attempts = [
    "postgresql://postgres:postgres@localhost:5432/postgres",
    "postgresql://postgres:admin@localhost:5432/postgres",
    "postgresql://postgres:root@localhost:5432/postgres",
    "postgresql://localhost:5432/postgres" // No password
  ];

  for (const str of attempts) {
    console.log("Trying: " + str);
    const success = await tryConnect(str);
    if (success) {
      console.log("SUCCESS! Please use this connection string in your .env");
      process.exit(0);
    }
  }
  console.log("ALL LOCAL CONNECTION ATTEMPTS FAILED.");
}

setup();
