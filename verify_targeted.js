const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const envParams = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        envParams[key] = val;
    }
});
const supabase = createClient(envParams['NEXT_PUBLIC_SUPABASE_URL'], envParams['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

const API_BASE_URL = 'https://rastreo.diacorserver.com/v3/apis/global_api/v3.1.0/public/index.php';

async function verifyKeyClients() {
    console.log('--- TARGETED AUDIT: AFINITI & FINANCAR ---');

    // 1. Live Data
    const loginRes = await fetch(API_BASE_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: envParams['NEXT_PUBLIC_FINDER_USER'], password: envParams['NEXT_PUBLIC_FINDER_PASSWORD'] }),
    });
    const { data: { token } } = await loginRes.json();
    const devRes = await fetch(API_BASE_URL + '/dispositivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    const { data: allDevices } = await devRes.json();

    const countLive = ids => allDevices.filter(d => ids.includes(String(d.id_usuario))).length;

    // 2. Afiniti (ID 8581)
    const afinitiLive = countLive(['10995']);
    const { count: afinitiDB } = await supabase.from('Vehiculos').select('*', { count: 'exact', head: true }).eq('Usuario_ID', 8581);
    const { data: afinitiCard } = await supabase.from('CLIENTES').select('Cantidad_Vehiculo').eq('id', 121);

    console.log(`AFINITI | Live: ${afinitiLive} | DB: ${afinitiDB} | Card: ${afinitiCard[0].Cantidad_Vehiculo}`);

    // 3. Financar (Cliente ID 6)
    const financarFinderIds = ['14156', '10768', '13909', '10243', '10649', '14155', '10222', '10223', '10484', '10518', '10520', '10519', '10516'];
    const financarLive = countLive(financarFinderIds);
    const { data: financarUsers } = await supabase.from('Usuarios').select('id').eq('CLIENTE_ID', 6);
    const financarInternalIds = financarUsers.map(u => u.id);
    const { count: financarDB } = await supabase.from('Vehiculos').select('*', { count: 'exact', head: true }).in('Usuario_ID', financarInternalIds);
    const { data: financarCard } = await supabase.from('CLIENTES').select('Cantidad_Vehiculo').eq('id', 6);

    console.log(`FINANCAR | Live: ${financarLive} | DB: ${financarDB} | Card: ${financarCard[0].Cantidad_Vehiculo}`);
}
verifyKeyClients();
