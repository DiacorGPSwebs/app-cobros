const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSyncLogic() {
    console.log('--- Testing Sync Calculation Logic ---');

    const { data: allStats, error: sError } = await supabase
        .from('Usuarios')
        .select('CLIENTE_ID, Vehiculos(count)')
        .not('CLIENTE_ID', 'is', null);

    if (sError) {
        console.error('Error in select:', sError);
        return;
    }

    console.log('Sample data from allStats (first 5):');
    console.log(JSON.stringify(allStats.slice(0, 5), null, 2));

    const clientCounts = new Map();
    allStats.forEach((u) => {
        // Checking the structure of u.Vehiculos
        const count = u.Vehiculos?.[0]?.count || 0;
        clientCounts.set(u.CLIENTE_ID, (clientCounts.get(u.CLIENTE_ID) || 0) + count);
    });

    console.log('\nCalculated clientCounts (first 5):');
    const sampleCounts = Array.from(clientCounts.entries()).slice(0, 5);
    console.log(sampleCounts);

    if (clientCounts.has(15)) {
        console.log(`\nAFINITI (ID 15) count: ${clientCounts.get(15)}`);
    } else {
        console.log('\nAFINITI (ID 15) not found in clientCounts!');
    }
}

testSyncLogic();
