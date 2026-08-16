import bcrypt from 'bcrypt';
import { pool } from './pool';
import { runMigrations } from './migrate';

// Mock flight dataset. Generated once, kept here as the seed source.
const flights = [
  { flight_number: 'AI101', airline: 'Air India', origin: 'DEL', destination: 'BOM', departure_date: '2026-09-01', departure_time: '08:00', arrival_time: '10:15', fare: 4500, seats_total: 180, seats_available: 180 },
  { flight_number: '6E202', airline: 'IndiGo', origin: 'DEL', destination: 'BOM', departure_date: '2026-09-01', departure_time: '12:30', arrival_time: '14:50', fare: 3800, seats_total: 180, seats_available: 180 },
  { flight_number: 'UK303', airline: 'Vistara', origin: 'DEL', destination: 'BLR', departure_date: '2026-09-02', departure_time: '06:45', arrival_time: '09:30', fare: 5200, seats_total: 160, seats_available: 160 },
  { flight_number: 'AI404', airline: 'Air India', origin: 'BOM', destination: 'DEL', departure_date: '2026-09-03', departure_time: '18:00', arrival_time: '20:15', fare: 4700, seats_total: 180, seats_available: 180 },
  { flight_number: '6E505', airline: 'IndiGo', origin: 'BLR', destination: 'DEL', departure_date: '2026-09-04', departure_time: '09:15', arrival_time: '12:00', fare: 4100, seats_total: 180, seats_available: 180 },
  { flight_number: 'SG606', airline: 'SpiceJet', origin: 'DEL', destination: 'MAA', departure_date: '2026-09-05', departure_time: '14:00', arrival_time: '17:00', fare: 5500, seats_total: 150, seats_available: 150 },
  { flight_number: 'AI707', airline: 'Air India', origin: 'DEL', destination: 'CCU', departure_date: '2026-09-06', departure_time: '07:30', arrival_time: '10:00', fare: 4900, seats_total: 170, seats_available: 170 },
  { flight_number: '6E808', airline: 'IndiGo', origin: 'BOM', destination: 'BLR', departure_date: '2026-09-07', departure_time: '11:00', arrival_time: '12:45', fare: 3200, seats_total: 180, seats_available: 180 },
  { flight_number: 'UK909', airline: 'Vistara', origin: 'DEL', destination: 'HYD', departure_date: '2026-09-08', departure_time: '16:30', arrival_time: '19:00', fare: 4800, seats_total: 160, seats_available: 160 },
  { flight_number: 'AI110', airline: 'Air India', origin: 'BLR', destination: 'BOM', departure_date: '2026-09-09', departure_time: '20:00', arrival_time: '21:45', fare: 3600, seats_total: 180, seats_available: 180 },
];

async function seed() {
  await runMigrations();

  // Wipe existing seed data so re-running is idempotent
  await pool.query('DELETE FROM passengers');
  await pool.query('DELETE FROM bookings');
  await pool.query('DELETE FROM flights');
  await pool.query('DELETE FROM refresh_tokens');
  await pool.query('DELETE FROM users');

  // Seed an admin and a regular user
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('user123', 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin'), ($4, $5, $6, 'user')`,
    [
      'admin@jadwelny.com', adminHash, 'Admin User',
      'user@jadwelny.com', userHash, 'Test User',
    ]
  );

  for (const f of flights) {
    await pool.query(
      `INSERT INTO flights
        (flight_number, airline, origin, destination, departure_date,
         departure_time, arrival_time, fare, seats_total, seats_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        f.flight_number, f.airline, f.origin, f.destination, f.departure_date,
        f.departure_time, f.arrival_time, f.fare, f.seats_total, f.seats_available,
      ]
    );
  }

  console.log(`Seeded ${flights.length} flights and 2 users (admin@jadwelny.com / admin123, user@jadwelny.com / user123)`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
