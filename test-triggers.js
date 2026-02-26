const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectAfiniti() {
    console.log('--- Inspecting AFINITI (ID 15) ---');
    const { data: cliente } = await supabase.from('CLIENTES').select('*').eq('id', 15).single();
    console.log('Cliente Cantidad_Vehiculo:', cliente.Cantidad_Vehiculo);

    const { data: users } = await supabase.from('Usuarios').select('*').eq('CLIENTE_ID', 15);
    console.log(`Linked Users (${users?.length || 0}):`);
    users?.forEach(u => console.log(`- ${u.Usuario} (ID: ${u.id}, finder_id: ${u.finder_id})`));

    for (const u of users || []) {
        const { count } = await supabase.from('Vehiculos').select('*', { count: 'exact', head: true }).eq('Usuario_ID', u.id);
        console.log(`  User ${u.Usuario} has ${count} vehicles.`);
    }
}

inspectAfiniti();
