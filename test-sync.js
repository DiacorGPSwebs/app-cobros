
async function triggerSync() {
    console.log('--- Iniciando Disparo de Sincronización ---');
    try {
        const response = await fetch('http://localhost:3000/api/sync', {
            method: 'POST'
        });
        const result = await response.json();
        console.log('Resultado:', result);
    } catch (error) {
        console.error('Error al disparar sync:', error);
    }
}

triggerSync();
