
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

        // 5. Normalización de Vehículos: Vincular vehículos manuales sin finder_id
        console.log('--- Normalizando vehículos manuales ---');
        const { data: existingNullVehicles } = await supabase
            .from('Vehiculos')
            .select('id, Placas, Usuario_ID')
            .is('finder_id', null);

        if (existingNullVehicles && existingNullVehicles.length > 0) {
            // Helper to normalize plates for matching (remove spaces, hyphens, etc)
            const normalizePlate = (p: string) => p.replace(/[^A-Z0-9]/gi, '').toUpperCase();

            // Create a map of "Usuario_ID-NormalizedPlaca" -> id
            const nullVehMap = new Map();
            existingNullVehicles.forEach(v => {
                if (v.Placas && v.Usuario_ID) {
                    const norm = normalizePlate(v.Placas);
                    if (norm) nullVehMap.set(`${v.Usuario_ID}-${norm}`, v.id);
                }
            });

            for (const d of finderDevices) {
                const internalUserId = userMap.get(String(d.id_usuario));
                const rawPlaca = d.placa && d.placa.trim() !== '' ? d.placa : (d.nombre || '');
                const normPlaca = normalizePlate(rawPlaca);

                if (internalUserId && normPlaca) {
                    const existingVehId = nullVehMap.get(`${internalUserId}-${normPlaca}`);
                    if (existingVehId) {
                        // Vinculamos el vehículo manual existente con su ID de Finder
                        console.log(`Vinculando vehículo manual ${existingVehId} con finder_id ${d.id_dispositivo}`);
                        await supabase
                            .from('Vehiculos')
                            .update({ finder_id: d.id_dispositivo })
                            .eq('id', existingVehId);
                    }
                }
            }
        }

        // 6. Sincronizar Vehículos con detección inteligente de placas
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

        // 7. LIMPIEZA DE DUPLICADOS: Eliminar registros residuales y fusionar datos manuales
        console.log('--- Limpiando duplicados y fusionando datos ---');

        let allVehsForCleanup: any[] = [];
        let vHasMore = true;
        let vOffset = 0;
        const V_PAGE_SIZE = 1000;

        while (vHasMore) {
            const { data: vPage, error: vFetchError } = await supabase
                .from('Vehiculos')
                .select('id, Placas, finder_id, Usuario_ID, Fecha_Anualidad')
                .range(vOffset, vOffset + V_PAGE_SIZE - 1);

            if (vFetchError) throw vFetchError;
            if (vPage && vPage.length > 0) {
                allVehsForCleanup = [...allVehsForCleanup, ...vPage];
                vOffset += V_PAGE_SIZE;
                vHasMore = vPage.length === V_PAGE_SIZE;
            } else {
                vHasMore = false;
            }
        }

        console.log(`Analizando ${allVehsForCleanup.length} vehículos para limpieza.`);

        if (allVehsForCleanup.length > 0) {
            const normalizePlate = (p: string) => String(p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const seen = new Map();
            const toDeleteIds: number[] = [];

            for (const v of allVehsForCleanup) {
                if (!v.Placas || !v.Usuario_ID) continue;
                const key = `${v.Usuario_ID}-${normalizePlate(v.Placas)}`;

                if (seen.has(key)) {
                    const existing = seen.get(key);

                    // Decidir cuál conservar: Preferimos el que tiene finder_id
                    let keep = existing;
                    let discard = v;

                    if (v.finder_id && !existing.finder_id) {
                        keep = v;
                        discard = existing;
                    }

                    // Si el descartado tiene fecha de anualidad y el que conservamos NO, 
                    // actualizamos el conservado para no perder el dato manual.
                    if (discard.Fecha_Anualidad && !keep.Fecha_Anualidad) {
                        await supabase
                            .from('Vehiculos')
                            .update({ Fecha_Anualidad: discard.Fecha_Anualidad })
                            .eq('id', keep.id);
                        keep.Fecha_Anualidad = discard.Fecha_Anualidad;
                    }

                    toDeleteIds.push(discard.id);
                    seen.set(key, keep);
                } else {
                    seen.set(key, v);
                }
            }

            if (toDeleteIds.length > 0) {
                console.log(`Eliminando ${toDeleteIds.length} duplicados residuales.`);
                for (let i = 0; i < toDeleteIds.length; i += 100) {
                    const chunk = toDeleteIds.slice(i, i + 100);
                    await supabase.from('Vehiculos').delete().in('id', chunk);
                }
            }
        }

        // 8. RECALCULAR CANTIDADES DE VEHÍCULOS PARA TODOS LOS CLIENTES
        console.log('--- Recalculando Cantidades de Vehículos ---');

        // 8.1 Obtener todos los vehículos con su Usuario_ID (Paginado)
        let allFinalVehs: any[] = [];
        let fvHasMore = true;
        let fvOffset = 0;
        while (fvHasMore) {
            const { data: fvPage, error: fvError } = await supabase
                .from('Vehiculos')
                .select('Usuario_ID')
                .range(fvOffset, fvOffset + 1000 - 1);
            if (fvError) throw fvError;
            if (fvPage && fvPage.length > 0) {
                allFinalVehs = [...allFinalVehs, ...fvPage];
                fvOffset += 1000;
                fvHasMore = fvPage.length === 1000;
            } else {
                fvHasMore = false;
            }
        }

        // 8.2 Obtener todos los usuarios vinculados a clientes (Paginado)
        let allUserLinks: any[] = [];
        let ulHasMore = true;
        let ulOffset = 0;
        while (ulHasMore) {
            const { data: ulPage, error: ulError } = await supabase
                .from('Usuarios')
                .select('id, CLIENTE_ID')
                .not('CLIENTE_ID', 'is', null)
                .range(ulOffset, ulOffset + 1000 - 1);
            if (ulError) throw ulError;
            if (ulPage && ulPage.length > 0) {
                allUserLinks = [...allUserLinks, ...ulPage];
                ulOffset += 1000;
                ulHasMore = ulPage.length === 1000;
            } else {
                ulHasMore = false;
            }
        }

        if (allFinalVehs.length > 0 && allUserLinks.length > 0) {
            // Mapeo Usuario_ID -> CLIENTE_ID
            const userToClient = new Map();
            allUserLinks.forEach(u => userToClient.set(u.id, u.CLIENTE_ID));

            // Conteo real por CLIENTE_ID (usando platos ÚNICOS para evitar discrepancias)
            const clientCounts = new Map();
            const seenPlates = new Set();
            const normalize = (p: string) => String(p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

            allFinalVehs.forEach(v => {
                const clientId = userToClient.get(v.Usuario_ID);
                if (clientId) {
                    const normPlate = normalize(v.Placas);
                    const key = `${v.Usuario_ID}-${normPlate}`;
                    if (normPlate && !seenPlates.has(key)) {
                        seenPlates.add(key);
                        clientCounts.set(clientId, (clientCounts.get(clientId) || 0) + 1);
                    }
                }
            });

            // Actualizar cada cliente con el conteo real
            const { data: allClients } = await supabase.from('CLIENTES').select('id');
            for (const c of allClients || []) {
                const total = clientCounts.get(c.id) || 0;
                await supabase
                    .from('CLIENTES')
                    .update({ Cantidad_Vehiculo: total })
                    .eq('id', c.id);
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
