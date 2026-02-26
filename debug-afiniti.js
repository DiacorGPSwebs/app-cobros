const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTotalVehicles() {
    const { count, error } = await supabase.from('Vehiculos').select('*', { count: 'exact', head: true });
    console.log(`Total vehicles in DB (Vehiculos table): ${count}`);
}

async function checkAfiniti() {
    await checkTotalVehicles();
    console.log('\nAnalyzing vehicles for User: AFINITI21 (ID: 75)');
    const { data: vehs, error } = await supabase.from('Vehiculos').select('*').eq('Usuario_ID', 75);

    if (error) {
        console.error('Error fetching vehicles:', error);
        return;
    }

    if (!vehs) {
        console.log('No vehicles found.');
        return;
    }

    console.log(`Total vehicles found: ${vehs.length}`);

    const plates = new Map();
    const finderIds = new Map();
    const plateDuplicates = [];
    const finderIdDuplicates = [];

    vehs.forEach(v => {
        const plate = v.Placas?.trim().toUpperCase();
        if (plate) {
            if (plates.has(plate)) {
                plateDuplicates.push({ value: plate, original: plates.get(plate), duplicate: v });
            } else {
                plates.set(plate, v);
            }
        }

        const fid = v.finder_id;
        if (fid) {
            if (finderIds.has(fid)) {
                finderIdDuplicates.push({ value: fid, original: finderIds.get(fid), duplicate: v });
            } else {
                finderIds.set(fid, v);
            }
        }
    });

    console.log(`\nUnique Plates: ${plates.size}`);
    console.log(`Unique Finder IDs: ${finderIds.size}`);
    console.log(`Plate Duplicates: ${plateDuplicates.length}`);
    console.log(`Finder ID Duplicates: ${finderIdDuplicates.length}`);

    if (plateDuplicates.length > 0) {
        console.log('\nDUPLICATE SAMPLES:');
        plateDuplicates.slice(0, 10).forEach(d => {
            console.log(`- Plate: ${d.value}`);
            console.log(`  Original: id=${d.original.id}, finder_id=${d.original.finder_id}`);
            console.log(`  Duplicate: id=${d.duplicate.id}, finder_id=${d.duplicate.finder_id}`);
        });
    }
}

checkAfiniti();
