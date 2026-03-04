
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
                    await supabase
                        .from('Usuarios')
                        .update({ finder_id: u.id_usuario })
                        .eq('id', existingId);
                }
            }
        }

        // 3. Sincronizar Usuarios
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

        // 4. Obtener mapeo finder_id -> internal_id
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

        const userMap = new Map();
        internalUsers?.forEach(u => userMap.set(u.finder_id, u.id));

        // 5. Normalización de Vehículos: Vincular manuales
        console.log('--- Normalizando vehículos manuales ---');
        const { data: existingNullVehicles } = await supabase
            .from('Vehiculos')
            .select('id, Placas, Usuario_ID')
            .is('finder_id', null);

        const normalizePlate = (p: string) => String(p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

        if (existingNullVehicles && existingNullVehicles.length > 0) {
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
                        await supabase
                            .from('Vehiculos')
                            .update({ finder_id: d.id_dispositivo })
                            .eq('id', existingVehId);
                    }
                }
            }
        }

        // 6. Sincronizar Vehículos
        const devicesToUpsert = finderDevices.map(d => ({
            finder_id: d.id_dispositivo,
            Placas: d.placa && d.placa.trim() !== '' ? d.placa.trim() : (d.nombre || 'S/N'),
            Usuario_ID: userMap.get(String(d.id_usuario)) || null,
        }));

        for (let i = 0; i < devicesToUpsert.length; i += 500) {
            const chunk = devicesToUpsert.slice(i, i + 500);
            const { error: vError } = await supabase
                .from('Vehiculos')
                .upsert(chunk, { onConflict: 'finder_id' });
            if (vError) throw vError;
        }

        // 7. LIMPIEZA DE DUPLICADOS Y OBSOLETOS
        console.log('--- Limpiando duplicados y obsoletos ---');
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

        if (allVehsForCleanup.length > 0) {
            const seen = new Map();
            const toDeleteIds: number[] = [];

            for (const v of allVehsForCleanup) {
                if (!v.Placas || !v.Usuario_ID) continue;
                const key = `${v.Usuario_ID}-${normalizePlate(v.Placas)}`;

                if (seen.has(key)) {
                    const existing = seen.get(key);
                    let keep = existing;
                    let discard = v;

                    if (v.finder_id && !existing.finder_id) {
                        keep = v;
                        discard = existing;
                    }

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
                for (let i = 0; i < toDeleteIds.length; i += 100) {
                    await supabase.from('Vehiculos').delete().in('id', toDeleteIds.slice(i, i + 100));
                }
            }
        }

        // 7.1 Limpiar obsoletos (no en Finder)
        const allRemoteFinderIds = new Set(finderDevices.map(d => String(d.id_dispositivo)));
        const obsoleteIds: number[] = [];
        for (const v of allVehsForCleanup) {
            if (v.finder_id && !allRemoteFinderIds.has(v.finder_id)) {
                obsoleteIds.push(v.id);
            }
        }
        if (obsoleteIds.length > 0) {
            for (let i = 0; i < obsoleteIds.length; i += 100) {
                await supabase.from('Vehiculos').delete().in('id', obsoleteIds.slice(i, i + 100));
            }
        }

        // 8. RECALCULAR CANTIDADES
        console.log('--- Recalculando Cantidades ---');

        // Refetch vehicles after cleanup
        let finalVehs: any[] = [];
        let fvOffset = 0;
        let fvHasMore = true;
        while (fvHasMore) {
            const { data: page, error } = await supabase.from('Vehiculos').select('Usuario_ID, Placas').range(fvOffset, fvOffset + 1000 - 1);
            if (error) throw error;
            if (page && page.length > 0) {
                finalVehs = [...finalVehs, ...page];
                fvOffset += 1000;
                fvHasMore = page.length === 1000;
            } else {
                fvHasMore = false;
            }
        }

        let userLinks: any[] = [];
        let ulOffset = 0;
        let ulHasMore = true;
        while (ulHasMore) {
            const { data: page, error } = await supabase.from('Usuarios').select('id, CLIENTE_ID').not('CLIENTE_ID', 'is', null).range(ulOffset, ulOffset + 1000 - 1);
            if (error) throw error;
            if (page && page.length > 0) {
                userLinks = [...userLinks, ...page];
                ulOffset += 1000;
                ulHasMore = page.length === 1000;
            } else {
                ulHasMore = false;
            }
        }

        if (finalVehs.length > 0 && userLinks.length > 0) {
            const uToC = new Map();
            userLinks.forEach(u => uToC.set(u.id, u.CLIENTE_ID));

            const clientCounts = new Map();

            finalVehs.forEach(v => {
                const clientId = uToC.get(v.Usuario_ID);
                if (clientId) {
                    clientCounts.set(clientId, (clientCounts.get(clientId) || 0) + 1);
                }
            });

            const { data: clients } = await supabase.from('CLIENTES').select('id');
            for (const c of clients || []) {
                const total = clientCounts.get(c.id) || 0;
                await supabase.from('CLIENTES').update({ Cantidad_Vehiculo: total }).eq('id', c.id);
            }
        }

        return NextResponse.json({ success: true, summary: { users: finderUsers.length, devices: finderDevices.length } });

    } catch (error: any) {
        console.error('Error en sincronización:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
