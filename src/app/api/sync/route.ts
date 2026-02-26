
import { NextResponse } from 'next/server';
import { finderApi } from '@/lib/finder';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        console.log('--- Iniciando Sincronización Masiva Refinada ---');

        // 1. Obtener datos de Finder AVL
        const [finderUsers, finderDevices] = await Promise.all([
            finderApi.getUsuarios(),
            finderApi.getDispositivos()
        ]);

        console.log(`Datos recibidos: ${finderUsers.length} usuarios, ${finderDevices.length} dispositivos.`);

        // 2. Normalización: Vincular usuarios existentes sin finder_id por nombre exacto
        // Esto evita duplicados como el caso de ANTONIO2019
        const { data: existingNullUsers } = await supabase
            .from('Usuarios')
            .select('id, Usuario')
            .is('finder_id', null);

        if (existingNullUsers && existingNullUsers.length > 0) {
            const nullMap = new Map();
            existingNullUsers.forEach(u => nullMap.set(u.Usuario.toUpperCase(), u.id));

            for (const u of finderUsers) {
                const existingId = nullMap.get(u.usuario.toUpperCase());
                if (existingId) {
                    // Vinculamos el registro existente con su ID de Finder antes del upsert masivo
                    await supabase
                        .from('Usuarios')
                        .update({ finder_id: u.id_usuario })
                        .eq('id', existingId);
                }
            }
        }

        // 3. Sincronizar Usuarios (UPSERT masivo)
        const usersToUpsert = finderUsers.map(u => ({
            finder_id: u.id_usuario,
            Usuario: u.usuario,
        }));

        for (let i = 0; i < usersToUpsert.length; i += 500) {
            const chunk = usersToUpsert.slice(i, i + 500);
            const { error: uError } = await supabase
                .from('Usuarios')
                .upsert(chunk, { onConflict: 'finder_id' });
            if (uError) throw uError;
        }

        // 4. Obtener mapeo actualizado de finder_id -> internal_id para Vehículos
        console.log('--- Obteniendo mapeo de usuarios internos ---');
        let internalUsers: any[] = [];
        let hasMore = true;
        let offset = 0;
        const PAGE_SIZE = 1000;

        while (hasMore) {
            const { data, error: fetchError } = await supabase
                .from('Usuarios')
                .select('id, finder_id')
                .range(offset, offset + PAGE_SIZE - 1);

            if (fetchError) throw fetchError;
            if (data && data.length > 0) {
                internalUsers = [...internalUsers, ...data];
                offset += PAGE_SIZE;
                hasMore = data.length === PAGE_SIZE;
            } else {
                hasMore = false;
            }
        }

        console.log(`Mapeo listo: ${internalUsers.length} usuarios indexados.`);

        const userMap = new Map();
        internalUsers?.forEach(u => userMap.set(u.finder_id, u.id));

        // 5. Sincronizar Vehículos con detección inteligente de placas
        const devicesToUpsert = finderDevices.map(d => ({
            finder_id: d.id_dispositivo,
            // Si la placa está vacía, usamos el nombre del dispositivo (Vehicle ID/Name)
            Placas: d.placa && d.placa.trim() !== '' ? d.placa.trim() : (d.nombre || 'S/N'),
            // Usamos String() para asegurar que el mapeo funcione independientemente del tipo (string vs number)
            Usuario_ID: userMap.get(String(d.id_usuario)) || null,
        }));

        for (let i = 0; i < devicesToUpsert.length; i += 500) {
            const chunk = devicesToUpsert.slice(i, i + 500);
            const { error: vError } = await supabase
                .from('Vehiculos')
                .upsert(chunk, { onConflict: 'finder_id' });
            if (vError) throw vError;
        }

        // 6. RECALCULAR CANTIDADES DE VEHÍCULOS PARA TODOS LOS CLIENTES
        console.log('--- Recalculando Cantidades de Vehículos ---');

        // Obtenemos todos los vínculos actuales Clientes -> Usuarios -> Vehículos
        const { data: allStats, error: sError } = await supabase
            .from('Usuarios')
            .select('CLIENTE_ID, Vehiculos(count)')
            .not('CLIENTE_ID', 'is', null);

        if (!sError && allStats) {
            // Agrupar conteos por Cliente
            const clientCounts = new Map();
            allStats.forEach((u: any) => {
                const count = u.Vehiculos?.[0]?.count || 0;
                clientCounts.set(u.CLIENTE_ID, (clientCounts.get(u.CLIENTE_ID) || 0) + count);
            });

            // Actualizar cada cliente
            for (const [clientId, total] of clientCounts.entries()) {
                await supabase
                    .from('CLIENTES')
                    .update({ Cantidad_Vehiculo: total })
                    .eq('id', clientId);
            }

            // También poner a 0 los clientes que no tienen usuarios/vehículos
            const { data: allClients } = await supabase.from('CLIENTES').select('id');
            const clientsWithData = new Set(clientCounts.keys());
            for (const c of allClients || []) {
                if (!clientsWithData.has(c.id)) {
                    await supabase.from('CLIENTES').update({ Cantidad_Vehiculo: 0 }).eq('id', c.id);
                }
            }
        }

        return NextResponse.json({
            success: true,
            summary: {
                users: finderUsers.length,
                devices: finderDevices.length
            }
        });

    } catch (error: any) {
        console.error('Error en sincronización:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
