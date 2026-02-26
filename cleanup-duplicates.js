const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
    console.log('--- Iniciando Limpieza de Duplicados ---');
    const { data: vehs, error } = await supabase.from('Vehiculos').select('*');

    if (error) {
        console.error('Error fetching vehicles:', error);
        return;
    }

    const byUser = new Map();
    vehs.forEach(v => {
        if (!byUser.has(v.Usuario_ID)) byUser.set(v.Usuario_ID, []);
        byUser.get(v.Usuario_ID).push(v);
    });

    let deletedCount = 0;
    let updatatedCount = 0;

    for (const [userId, userVehs] of byUser.entries()) {
        const platesMap = new Map(); // Plate -> record

        userVehs.forEach(v => {
            const plate = v.Placas?.trim().toUpperCase();
            if (!plate) return;

            if (platesMap.has(plate)) {
                const original = platesMap.get(plate);
                const duplicate = v;

                // Decision logic: keep the one with finder_id
                let toKeep, toDelete;
                if (duplicate.finder_id && !original.finder_id) {
                    toKeep = duplicate;
                    toDelete = original;
                } else if (!duplicate.finder_id && original.finder_id) {
                    toKeep = original;
                    toDelete = duplicate;
                } else {
                    // Both have finder_id or both don't. Keep the one with an ID by default (usually lower ID is older)
                    toKeep = original.id < duplicate.id ? original : duplicate;
                    toDelete = original.id < duplicate.id ? duplicate : original;
                }

                // Transfer data if needed (e.g. Fecha_Anualidad)
                if (toDelete.Fecha_Anualidad && !toKeep.Fecha_Anualidad) {
                    console.log(`- Transferring Fecha_Anualidad from ${toDelete.id} to ${toKeep.id}`);
                    // Note: Update is done later or immediately
                    toKeep.pendingUpdate = { Fecha_Anualidad: toDelete.Fecha_Anualidad };
                }

                // Mark for deletion
                toDelete.markForDeletion = true;
                platesMap.set(plate, toKeep); // Ensure we keep the "best" one in the map for further comparisons
            } else {
                platesMap.set(plate, v);
            }
        });
    }

    const marksForDeletion = vehs.filter(v => v.markForDeletion);
    console.log(`Total records marked for deletion: ${marksForDeletion.length}`);

    for (const v of marksForDeletion) {
        console.log(`Deleting vehicle ID: ${v.id}, Plate: ${v.Placas?.trim()}, UserID: ${v.Usuario_ID}`);
        const { error: delError } = await supabase.from('Vehiculos').delete().eq('id', v.id);
        if (delError) console.error(`  Error deleting ${v.id}:`, delError.message);
        else deletedCount++;
    }

    const pendingUpdates = vehs.filter(v => v.pendingUpdate);
    for (const v of pendingUpdates) {
        console.log(`Updating vehicle ID: ${v.id} with ${JSON.stringify(v.pendingUpdate)}`);
        const { error: updError } = await supabase.from('Vehiculos').update(v.pendingUpdate).eq('id', v.id);
        if (updError) console.error(`  Error updating ${v.id}:`, updError.message);
        else updatatedCount++;
    }

    console.log(`\n--- Resumen ---`);
    console.log(`Borrados: ${deletedCount}`);
    console.log(`Actualizados: ${updatatedCount}`);
}

cleanup();
