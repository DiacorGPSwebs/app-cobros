
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function consolidate() {
    console.log('--- Iniciando Consolidación de Usuarios Duplicados (v2) ---');

    // 1. Obtener todos los usuarios
    const { data: allUsers, error } = await supabase.from('Usuarios').select('*');
    if (error) throw error;

    // 2. Agrupar por nombre (Case Insensitive)
    const groups = new Map();
    allUsers.forEach(u => {
        const key = u.Usuario.toUpperCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(u);
    });

    console.log(`Analizando ${groups.size} grupos de usuarios unique...`);

    for (const [name, users] of groups.entries()) {
        if (users.length > 1) {
            console.log(`\nProcesando duplicados para: ${name}`);

            // Buscar el que tiene finder_id (el "oficial" sincronizado)
            const official = users.find(u => u.finder_id !== null);
            // El resto son redundantes
            const redundants = users.filter(u => u.id !== official?.id);

            if (official && redundants.length > 0) {
                for (const linked of redundants) {
                    console.log(`Fusionando ID ${linked.id} -> ID ${official.id} (oficial)`);

                    // A. Mover el CLIENTE_ID al oficial si el oficial no lo tiene
                    if (linked.CLIENTE_ID && !official.CLIENTE_ID) {
                        await supabase
                            .from('Usuarios')
                            .update({ CLIENTE_ID: linked.CLIENTE_ID })
                            .eq('id', official.id);
                        console.log(`- CLIENTE_ID movido a ${official.id}`);
                    }

                    // B. Re-apuntar VEHÍCULOS
                    const { error: reError } = await supabase
                        .from('Vehiculos')
                        .update({ Usuario_ID: official.id })
                        .eq('Usuario_ID', linked.id);

                    if (reError) {
                        console.error(`- Error al re-apuntar vehículos de ${linked.id}:`, reError.message);
                    } else {
                        console.log(`- Vehículos re-apuntados a ${official.id}`);
                    }

                    // C. Borrar el duplicado
                    const { error: deleteError } = await supabase
                        .from('Usuarios')
                        .delete()
                        .eq('id', linked.id);

                    if (deleteError) {
                        console.error(`- Error al borrar duplicado ${linked.id}:`, deleteError.message);
                    } else {
                        console.log(`- Registro duplicado ${linked.id} eliminado con éxito.`);
                    }
                }
            }
        }
    }

    console.log('\n--- Consolidación Finalizada ---');
}

consolidate();
