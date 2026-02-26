const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getAllVehicles() {
    console.log('Fetching all vehicles with pagination...');
    let allVehicles = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('Vehiculos')
            .select('*')
            .range(from, from + pageSize - 1);

        if (error) {
            console.error('Error fetching vehicles:', error);
            throw error;
        }

        allVehicles = allVehicles.concat(data);
        console.log(`Fetched ${allVehicles.length} vehicles...`);

        if (data.length < pageSize) {
            hasMore = false;
        } else {
            from += pageSize;
        }
    }
    return allVehicles;
}

async function comprehensiveCleanup() {
    console.log('--- Iniciando Limpieza COMPRESIVA de Duplicados ---');

    const vehs = await getAllVehicles();
    console.log(`Total records to analyze: ${vehs.length}`);

    const byUser = new Map();
    vehs.forEach(v => {
        const uId = v.Usuario_ID || 'null';
        if (!byUser.has(uId)) byUser.set(uId, []);
        byUser.get(uId).push(v);
    });

    let deletedCount = 0;
    let updatatedCount = 0;
    const toDeleteIds = [];
    const updates = [];

    for (const [userId, userVehs] of byUser.entries()) {
        const platesMap = new Map(); // Plate -> best record found so far

        userVehs.forEach(v => {
            const plate = v.Placas?.trim().toUpperCase();
            if (!plate) return;

            if (platesMap.has(plate)) {
                const existing = platesMap.get(plate);
                const current = v;

                let toKeep, toDelete;

                // Prioritize the one with finder_id
                if (current.finder_id && !existing.finder_id) {
                    toKeep = current;
                    toDelete = existing;
                } else if (!current.finder_id && existing.finder_id) {
                    toKeep = existing;
                    toDelete = current;
                } else if (current.finder_id && existing.finder_id) {
                    // Both have finder_id. This is tricky. 
                    // Let's keep the newer one or just the first one?
                    // User said there are 174 on platform, so keeping ANY with finder_id is better than keeping both.
                    // But if plates match for the SAME user, they are likely the same vehicle.
                    toKeep = existing.id < current.id ? existing : current;
                    toDelete = existing.id < current.id ? current : existing;
                } else {
                    // Neither has finder_id.
                    toKeep = existing.id < current.id ? existing : current;
                    toDelete = existing.id < current.id ? current : existing;
                }

                if (toDelete.Fecha_Anualidad && !toKeep.Fecha_Anualidad) {
                    updates.push({ id: toKeep.id, data: { Fecha_Anualidad: toDelete.Fecha_Anualidad } });
                }

                toDeleteIds.push(toDelete.id);
                platesMap.set(plate, toKeep);
            } else {
                platesMap.set(plate, v);
            }
        });
    }

    // De-duplicate toDeleteIds just in case one record was marked twice
    const finalDeleteIds = [...new Set(toDeleteIds)];
    console.log(`\nRecords to delete: ${finalDeleteIds.length}`);

    // Chunk deletions to avoid URL length issues or timeouts
    const batchSize = 100;
    for (let i = 0; i < finalDeleteIds.length; i += batchSize) {
        const batch = finalDeleteIds.slice(i, i + batchSize);
        console.log(`Deleting batch ${i / batchSize + 1} (${batch.length} records)...`);
        const { error } = await supabase.from('Vehiculos').delete().in('id', batch);
        if (error) console.error('  Error deleting batch:', error.message);
        else deletedCount += batch.length;
    }

    for (const upd of updates) {
        // Skip if the record being updated is also being deleted
        if (finalDeleteIds.includes(upd.id)) continue;

        const { error } = await supabase.from('Vehiculos').update(upd.data).eq('id', upd.id);
        if (!error) updatatedCount++;
    }

    console.log(`\n--- Resumen Final ---`);
    console.log(`Borrados: ${deletedCount}`);
    console.log(`Actualizados: ${updatatedCount}`);
}

comprehensiveCleanup();
