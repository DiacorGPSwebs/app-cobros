const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function finalCleanup() {
    console.log('--- Cleaning Antonio Pedregal Ghosts ---');
    // Antonio User ID is 165
    const { data: vehs } = await supabase.from('Vehiculos').select('*').eq('Usuario_ID', 165);

    // We saw they have records with finder_id and records without.
    const withFid = vehs.filter(v => v.finder_id !== null);
    const withoutFid = vehs.filter(v => v.finder_id === null);

    console.log(`Vehicles with Finder ID: ${withFid.length}`);
    console.log(`Vehicles without Finder ID: ${withoutFid.length}`);

    let deletedCount = 0;
    for (const ghost of withoutFid) {
        const plate = ghost.Placas.trim().toUpperCase();
        // Check if we have a "valid" counterpart for this plate
        const matchingReal = withFid.find(v => v.Placas.trim().toUpperCase() === plate);

        if (matchingReal) {
            console.log(`Deleting ghost ${ghost.id} for plate ${plate} (Matched with real record ${matchingReal.id})`);
            const { error } = await supabase.from('Vehiculos').delete().eq('id', ghost.id);
            if (!error) deletedCount++;
        } else {
            console.log(`Ghost ${ghost.id} (Plate: ${plate}) has no real counterpart. Keeping it for now.`);
        }
    }
    console.log(`Deleted ${deletedCount} ghosts.`);
}

finalCleanup();
