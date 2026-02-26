const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser(username) {
    console.log(`--- Checking User: ${username} ---`);
    const { data: user, error } = await supabase
        .from('Usuarios')
        .select('*, CLIENTES(Nombre_Completo)')
        .eq('Usuario', username)
        .single();

    if (error) {
        console.error('Error fetching user:', error);
        return;
    }

    console.log('User Data:', user);

    const { count } = await supabase
        .from('Vehiculos')
        .select('*', { count: 'exact', head: true })
        .eq('Usuario_ID', user.id);

    console.log(`Vehicle count in DB: ${count}`);
}

checkUser('KIARIO-R');
checkUser('GRANI10-G');
checkUser('CARROSNUEVOS');
