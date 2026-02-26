const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ugyagkmgkmljqixgrnmu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneWFna21na21sanFpeGdybm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDgzODYsImV4cCI6MjA4NTIyNDM4Nn0.J9duaguAZZ-bM0RbQNjdTdyXZv_N8ivbFtFFnLKmYZw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log('Testing CLIENTES...');
    const { data: c, error: ec } = await supabase.from('CLIENTES').select('*').limit(5);
    console.log('CLIENTES:', c ? `Found ${c.length} records` : 'Error or Empty', ec || '');

    console.log('\nTesting Usuarios...');
    const { data: u, error: eu } = await supabase.from('Usuarios').select('*').limit(5);
    console.log('Usuarios:', u ? `Found ${u.length} records` : 'Error or Empty', eu || '');

    console.log('\nTesting Vehiculos...');
    const { data: v, error: ev } = await supabase.from('Vehiculos').select('*').limit(5);
    console.log('Vehiculos:', v ? `Found ${v.length} records` : 'Error or Empty', ev || '');
}

test();
