
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function consolidate() {
    console.log('--- Iniciando Consolidación de Usuarios Duplicados (v3 - Con mejor logging) ---');

    const { data: allUsers, error } = await supabase.from('Usuarios').select('*');
    if (error) throw error;

    const groups = new Map();
    allUsers.forEach(u => {
        if (!u.Usuario) return;
        const key = u.Usuario.trim().toUpperCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(u);
    });

    console.log(`Analizando ${groups.size} grupos de usuarios unique...`);

    for (const [name, users] of groups.entries()) {
        if (users.length > 1) {
            console.log(`\nGRUPO: '${name}' (%d registros)`, users.length);

            const official = users.find(u => u.finder_id !== null);
            if (!official) {
                console.log(`- Alerta: Grupo '${name}' tiene duplicados pero NINGUNO tiene finder_id. No puedo consolidar automáticamente.`);
                continue;
            }

            const redundants = users.filter(u => u.id !== official.id);
            for (const r of redundants) {
                console.log(`- Fusionando ID \${r.id} -> ID \${official.id}`);

                // Mover CLIENTE_ID
                if (r.CLIENTE_ID && !official.CLIENTE_ID) {
                    await supabase.from('Usuarios').update({ CLIENTE_ID: r.CLIENTE_ID }).eq('id', official.id);
                    console.log(`  * CLIENTE_ID movido.`);
                }

                // Re-apuntar vehículos
                const { error: revError } = await supabase.from('Vehiculos').update({ Usuario_ID: official.id }).eq('Usuario_ID', r.id);
                if (revError) console.error(`  * Error vehículos: \${revError.message}`);
                else console.log(`  * Vehículos movidos.`);

                // Borrar duplicado
                const { error: delError } = await supabase.from('Usuarios').delete().eq('id', r.id);
                if (delError) console.error(`  * Error borrado: \${delError.message}`);
                else console.log(`  * Duplicado eliminado.`);
            }
        }
    }
    console.log('\n--- Finalizado ---');
}
consolidate();
