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

async function finalAudit() {
    console.log('--- DEFINITIVE GLOBAL AUDIT ---');

    // 1. Live Data
    const loginRes = await fetch(API_BASE_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: envParams['NEXT_PUBLIC_FINDER_USER'], password: envParams['NEXT_PUBLIC_FINDER_PASSWORD'] }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    const devRes = await fetch(API_BASE_URL + '/dispositivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    const devData = await devRes.json();
    const allFinderDevices = devData.data;

    const finderCounts = new Map();
    allFinderDevices.forEach(d => {
        const uid = String(d.id_usuario);
        finderCounts.set(uid, (finderCounts.get(uid) || 0) + 1);
    });

    // 2. DB Data
    const { data: allClients } = await supabase.from('CLIENTES').select('id, Nombre_Completo, Cantidad_Vehiculo');
    const { data: allUsers } = await supabase.from('Usuarios').select('id, CLIENTE_ID, finder_id');
    const clientMap = new Map();
    allClients.forEach(c => clientMap.set(c.id, c));

    const clientToUsers = new Map();
    allUsers.forEach(u => {
        if (!clientToUsers.has(u.CLIENTE_ID)) clientToUsers.set(u.CLIENTE_ID, []);
        clientToUsers.get(u.CLIENTE_ID).push(u);
    });

    console.log('--------------------------------------------------------------------------------');
    console.log('CLIENTE                        | LIVE | DB   | CARD | ESTADO');
    console.log('--------------------------------------------------------------------------------');

    let totalDiscrepancies = 0;
    for (const c of allClients) {
        const users = clientToUsers.get(c.id) || [];
        const finderUserIds = users.filter(u => u.finder_id).map(u => String(u.finder_id));
        if (finderUserIds.length === 0) continue;

        let totalLive = 0;
        finderUserIds.forEach(fid => totalLive += (finderCounts.get(fid) || 0));

        const userIds = users.map(u => u.id);
        const { count: dbCount } = await supabase.from('Vehiculos').select('*', { count: 'exact', head: true }).in('Usuario_ID', userIds);

        const cardCount = c.Cantidad_Vehiculo || 0;
        const isMatch = totalLive === dbCount && dbCount === cardCount;
        if (!isMatch) totalDiscrepancies++;

        console.log(`${c.Nombre_Completo.substring(0, 30).padEnd(30)} | ${String(totalLive).padEnd(4)} | ${String(dbCount).padEnd(4)} | ${String(cardCount).padEnd(4)} | ${isMatch ? '✅' : '❌'}`);
    }
    console.log('--------------------------------------------------------------------------------');
    console.log('Total discrepancies: ' + totalDiscrepancies);
}
finalAudit().catch(console.error);
