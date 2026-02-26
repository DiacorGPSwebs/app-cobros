
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getAllUsers() {
    let allData = [];
    let from = 0;
    let to = 999;
    let finished = false;

    while (!finished) {
        const { data, error } = await supabase
            .from('Usuarios')
            .select('*')
            .range(from, to);

        if (error) throw error;
        if (data.length === 0) {
            finished = true;
        } else {
            allData = allData.concat(data);
            from += 1000;
            to += 1000;
            if (data.length < 1000) finished = true;
        }
    }
    return allData;
}

async function consolidate() {
    console.log('--- Iniciando Consolidación SIN LÍMITES (v4) ---');

    const allUsers = await getAllUsers();
    console.log(`Total usuarios cargados: ${allUsers.length}`);

    const groups = new Map();
    allUsers.forEach(u => {
        if (!u.Usuario) return;
        const key = u.Usuario.trim().toUpperCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(u);
    });

    for (const [name, users] of groups.entries()) {
        if (users.length > 1) {
            const official = users.find(u => u.finder_id !== null);
            if (!official) continue;

            console.log(`\nFUSIONANDO DUPLICADOS: ${name}`);
            const redundants = users.filter(u => u.id !== official.id);
            for (const r of redundants) {
                console.log(`- Moviendo de ${r.id} a ${official.id} (oficial)`);

                if (r.CLIENTE_ID && !official.CLIENTE_ID) {
                    await supabase.from('Usuarios').update({ CLIENTE_ID: r.CLIENTE_ID }).eq('id', official.id);
                }

                await supabase.from('Vehiculos').update({ Usuario_ID: official.id }).eq('Usuario_ID', r.id);
                const { error: delError } = await supabase.from('Usuarios').delete().eq('id', r.id);

                if (delError) console.error(`  * Error: ${delError.message}`);
                else console.log(`  * Éxito.`);
            }
        }
    }
    console.log('\n--- Proceso Finalizado ---');
}
consolidate();
