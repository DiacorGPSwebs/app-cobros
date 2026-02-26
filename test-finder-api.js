
const API_BASE_URL = 'https://rastreo.diacorserver.com/v3/apis/global_api/v3.1.0/public/index.php';

async function testConnection() {
    const user = 'Rastrealogps';
    const password = 'panama3030';

    console.log('--- Iniciando Prueba de Conexión Finder AVL ---');
    console.log('Intentando Login...');

    try {
        const loginRes = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, password }),
        });

        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error('Error en Login:', loginData);
            return;
        }

        const token = loginData.data.token;
        console.log('✅ Login Exitoso. Token obtenido (primeros 20 chars):', token.substring(0, 20) + '...');

        console.log('\nConsultando Usuarios...');
        const usersRes = await fetch(`${API_BASE_URL}/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const usersData = await usersRes.json();
        if (usersData.success) {
            console.log(`✅ Usuarios obtenidos: ${usersData.data.length}`);
            if (usersData.data.length > 0) {
                console.log('Ejemplo primer usuario:', usersData.data[0].usuario, '-', usersData.data[0].nombre);
            }
        } else {
            console.error('Error al obtener usuarios:', usersData);
        }

        console.log('\nConsultando Dispositivos...');
        const devRes = await fetch(`${API_BASE_URL}/dispositivos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const devData = await devRes.json();
        if (devData.success) {
            console.log(`✅ Dispositivos obtenidos: ${devData.data.length}`);
            if (devData.data.length > 0) {
                console.log('Ejemplo primer vehículo Placa:', devData.data[0].placa, 'IMEI:', devData.data[0].imei);
            }
        } else {
            console.error('Error al obtener dispositivos:', devData);
        }

        console.log('\n--- Prueba Finalizada (SOLO LECTURA) ---');
        console.log('Nota: No se ha realizado ninguna operación de escritura o bloqueo.');

    } catch (error) {
        console.error('Error fatal en la prueba:', error);
    }
}

testConnection();
