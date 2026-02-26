const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGlobalDuplicates() {
    console.log('Searching for global duplicates in Vehiculos...');
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

    console.log(`Total Usuarios with vehicles: ${byUser.size}`);

    let totalDuplicates = 0;
    const affectedUsers = [];

    for (const [userId, userVehs] of byUser.entries()) {
        const plates = new Set();
        const dupes = [];
        userVehs.forEach(v => {
            const plate = v.Placas?.trim().toUpperCase();
            if (plate) {
                if (plates.has(plate)) {
                    dupes.push(v);
                } else {
                    plates.add(plate);
                }
            }
        });

        if (dupes.length > 0) {
            totalDuplicates += dupes.length;
            affectedUsers.push({ userId, count: dupes.length });
        }
    }

    console.log(`Total duplicate vehicles found: ${totalDuplicates}`);
    console.log(`Total users affected: ${affectedUsers.length}`);

    if (affectedUsers.length > 0) {
        console.log('\nAffected Users Sample:');
        for (const au of affectedUsers.slice(0, 10)) {
            const { data: user } = await supabase.from('Usuarios').select('Usuario').eq('id', au.userId).single();
            console.log(`- User: ${user?.Usuario} (ID: ${au.userId}), Duplicates: ${au.count}`);
        }
    }
}

checkGlobalDuplicates();
