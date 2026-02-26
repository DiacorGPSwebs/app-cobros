const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function repairCounts() {
    console.log('--- Repairing Equipment Counts ---');

    // 1. Get all clients
    const { data: clientes } = await supabase.from('CLIENTES').select('id, Nombre_Completo, Cantidad_Vehiculo');

    for (const cliente of clientes || []) {
        console.log(`Checking ${cliente.Nombre_Completo} (ID: ${cliente.id})...`);

        const { count, error } = await supabase
            .from('Vehiculos')
            .select('*', { count: 'exact', head: true })
            .filter('Usuario_ID', 'in',
                supabase.from('Usuarios').select('id').eq('CLIENTE_ID', cliente.id)
            );

        // Note: The nested query above might not work depending on Supabase version/driver.
        // Let's do it simply:
        const { data: users } = await supabase.from('Usuarios').select('id').eq('CLIENTE_ID', cliente.id);
        const userIds = users?.map(u => u.id) || [];

        let actualCount = 0;
        if (userIds.length > 0) {
            const { count: vCount } = await supabase
                .from('Vehiculos')
                .select('*', { count: 'exact', head: true })
                .in('Usuario_ID', userIds);
            actualCount = vCount || 0;
        }

        if (cliente.Cantidad_Vehiculo !== actualCount) {
            console.log(`  Updating count: ${cliente.Cantidad_Vehiculo} -> ${actualCount}`);
            const { error: updErr } = await supabase
                .from('CLIENTES')
                .update({ Cantidad_Vehiculo: actualCount })
                .eq('id', cliente.id);

            if (updErr) console.error(`  Error updating ${cliente.id}:`, updErr);
        } else {
            console.log(`  Count is correct (${actualCount}).`);
        }
    }
    console.log('--- Repair Finished ---');
}

repairCounts();
