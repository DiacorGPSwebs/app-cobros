
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Verificando Columnas de Usuarios ---');
    const { data: uData, error: uError } = await supabase
        .from('Usuarios')
        .select('*')
        .limit(1);

    if (uError) {
        console.error('Error al consultar Usuarios:', uError);
    } else {
        console.log('Columnas encontradas en Usuarios:', Object.keys(uData[0] || {}));
    }

    console.log('\n--- Verificando Columnas de Vehiculos ---');
    const { data: vData, error: vError } = await supabase
        .from('Vehiculos')
        .select('*')
        .limit(1);

    if (vError) {
        console.error('Error al consultar Vehiculos:', vError);
    } else {
        console.log('Columnas encontradas en Vehiculos:', Object.keys(vData[0] || {}));
    }
}

checkSchema();
