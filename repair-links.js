const { createClient } = require('@supabase/supabase-js');

const API_BASE_URL = 'https://rastreo.diacorserver.com/v3/apis/global_api/v3.1.0/public/index.php';
const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function repair() {
    console.log('--- Starting Repair Analysis ---');

    // 1. Login to Finder
    const authRes = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user: 'Rastrealogps',
            password: 'panama3030'
        }),
    });
    const auth = await authRes.json();
    const token = auth.data.token;

    // 2. Get Users
    const uRes = await fetch(`${API_BASE_URL}/usuarios`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const uData = await uRes.json();
    const finderUsers = uData.data;

    const targetUsers = finderUsers.filter(u =>
        ['Picanto', 'Soluto', 'GRANI10-G', 'KIARIO-R'].some(name => u.usuario.toLowerCase() === name.toLowerCase())
    );
    console.log('Target Users in Finder:', targetUsers);

    // 3. Get Devices
    const dRes = await fetch(`${API_BASE_URL}/dispositivos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dData = await dRes.json();
    const finderDevices = dData.data;

    console.log('Total Devices in Finder:', finderDevices.length);

    // 4. Map devices to our target users
    for (const u of targetUsers) {
        const devices = finderDevices.filter(d => String(d.id_usuario) === String(u.id_usuario));
        console.log(`User ${u.usuario} (ID ${u.id_usuario}) has ${devices.length} devices in Finder.`);

        // Check if any sample device exists in our DB
        if (devices.length > 0) {
            const sample = devices[0];
            const { data: dbVeh } = await supabase.from('Vehiculos').select('*').eq('finder_id', sample.id_dispositivo).single();
            console.log(`  Sample Device ${sample.placa} (Finder ${sample.id_dispositivo}) in DB:`, dbVeh ? `Found (Usuario_ID: ${dbVeh.Usuario_ID})` : 'NOT FOUND');
        }
    }
}

repair();
