'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Search, Plus, Cpu, Smartphone, Edit3, Loader2, X, RefreshCw, Save, Download } from 'lucide-react';
import { format } from 'date-fns';
import { exportToCSV } from '@/lib/exportUtils';

interface GPS {
    id: string;
    imei: string;
    modelo: string;
    estado: 'EN STOCK' | 'EN PLATAFORMA' | 'DAÑADO';
    telefono_asignado: string | null;
    cliente_id: number | null;
    fecha_instalacion: string | null;
    CLIENTES?: { Nombre_Completo: string };
}

interface SIM {
    id: string;
    numero_telefono: string;
    operadora: 'TIGO' | 'C&W' | 'OTRO';
    estado: 'EN STOCK' | 'EN PLATAFORMA' | 'SUSPENDIDA';
    imei_asignado: string | null;
    cliente_id: number | null;
    CLIENTES?: { Nombre_Completo: string };
}

export default function InventarioPage() {
    const [activeTab, setActiveTab] = useState<'GPS' | 'SIM'>('GPS');
    const [isLoading, setIsLoading] = useState(true);
    const [gpsList, setGpsList] = useState<GPS[]>([]);
    const [simList, setSimList] = useState<SIM[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);

    // Filtros GPS
    const [gpsSearch, setGpsSearch] = useState('');
    const [gpsEstadoFilter, setGpsEstadoFilter] = useState('ALL');
    const [gpsModeloFilter, setGpsModeloFilter] = useState('ALL');

    // Filtros SIM
    const [simSearch, setSimSearch] = useState('');
    const [simEstadoFilter, setSimEstadoFilter] = useState('ALL');
    const [simOperadoraFilter, setSimOperadoraFilter] = useState('ALL');

    // Modales
    const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
    const [isSimModalOpen, setIsSimModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingGpsId, setEditingGpsId] = useState<string | null>(null);
    const [editingSimId, setEditingSimId] = useState<string | null>(null);

    // Form states
    const [gpsForm, setGpsForm] = useState<{ imei: string, modelo: string, estado: GPS['estado'], telefono_asignado: string, cliente_id: string, fecha_instalacion: string }>({
        imei: '', modelo: '', estado: 'EN STOCK', telefono_asignado: '', cliente_id: '', fecha_instalacion: ''
    });
    const [simForm, setSimForm] = useState<{ numero_telefono: string, operadora: SIM['operadora'], estado: SIM['estado'], imei_asignado: string, cliente_id: string }>({
        numero_telefono: '', operadora: 'TIGO', estado: 'EN STOCK', imei_asignado: '', cliente_id: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [gpsRes, simsRes, clientesRes] = await Promise.all([
                supabase.from('Inventario_GPS').select('*, CLIENTES(Nombre_Completo)').order('created_at', { ascending: false }),
                supabase.from('Inventario_SIMs').select('*, CLIENTES(Nombre_Completo)').order('created_at', { ascending: false }),
                supabase.from('CLIENTES').select('id, Nombre_Completo').order('Nombre_Completo', { ascending: true })
            ]);

            if (gpsRes.error) throw gpsRes.error;
            if (simsRes.error) throw simsRes.error;

            setGpsList(gpsRes.data || []);
            setSimList(simsRes.data || []);
            setClientes(clientesRes.data || []);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            // Optionally set an error state
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveGps = async () => {
        if (!gpsForm.imei || !gpsForm.modelo) {
            alert('El IMEI y el modelo son obligatorios');
            return;
        }
        setIsSaving(true);
        try {
            const cId = gpsForm.cliente_id ? parseInt(gpsForm.cliente_id) : null;
            const payload = {
                imei: gpsForm.imei,
                modelo: gpsForm.modelo,
                estado: gpsForm.estado,
                telefono_asignado: gpsForm.telefono_asignado || null,
                cliente_id: cId,
                fecha_instalacion: gpsForm.fecha_instalacion || null,
            };

            if (editingGpsId) {
                const { error } = await supabase.from('Inventario_GPS').update(payload).eq('id', editingGpsId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('Inventario_GPS').insert([payload]);
                if (error) throw error;
            }

            // Cross-update SIM if phone is assigned
            if (payload.telefono_asignado) {
                await supabase.from('Inventario_SIMs')
                    .update({ imei_asignado: payload.imei, cliente_id: cId, estado: 'EN PLATAFORMA' })
                    .eq('numero_telefono', payload.telefono_asignado);
            }

            setIsGpsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert('Error guardando GPS: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSim = async () => {
        if (!simForm.numero_telefono) {
            alert('El número de teléfono es obligatorio');
            return;
        }
        setIsSaving(true);
        try {
            const cId = simForm.cliente_id ? parseInt(simForm.cliente_id) : null;
            const payload = {
                numero_telefono: simForm.numero_telefono,
                operadora: simForm.operadora,
                estado: simForm.estado,
                imei_asignado: simForm.imei_asignado || null,
                cliente_id: cId,
            };

            if (editingSimId) {
                const { error } = await supabase.from('Inventario_SIMs').update(payload).eq('id', editingSimId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('Inventario_SIMs').insert([payload]);
                if (error) throw error;
            }

            // Cross-update GPS if IMEI is assigned
            if (payload.imei_asignado) {
                await supabase.from('Inventario_GPS')
                    .update({ telefono_asignado: payload.numero_telefono, cliente_id: cId, estado: 'EN PLATAFORMA' })
                    .eq('imei', payload.imei_asignado);
            }

            setIsSimModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert('Error guardando SIM: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const openGpsModal = (gps?: GPS) => {
        if (gps) {
            setEditingGpsId(gps.id);
            setGpsForm({
                imei: gps.imei,
                modelo: gps.modelo,
                estado: gps.estado,
                telefono_asignado: gps.telefono_asignado || '',
                cliente_id: gps.cliente_id?.toString() || '',
                fecha_instalacion: gps.fecha_instalacion || ''
            });
        } else {
            setEditingGpsId(null);
            setGpsForm({ imei: '', modelo: '', estado: 'EN STOCK', telefono_asignado: '', cliente_id: '', fecha_instalacion: '' });
        }
        setIsGpsModalOpen(true);
    };

    const openSimModal = (sim?: SIM) => {
        if (sim) {
            setEditingSimId(sim.id);
            setSimForm({
                numero_telefono: sim.numero_telefono,
                operadora: sim.operadora,
                estado: sim.estado,
                imei_asignado: sim.imei_asignado || '',
                cliente_id: sim.cliente_id?.toString() || ''
            });
        } else {
            setEditingSimId(null);
            setSimForm({ numero_telefono: '', operadora: 'TIGO', estado: 'EN STOCK', imei_asignado: '', cliente_id: '' });
        }
        setIsSimModalOpen(true);
    };

    // Derived states for UI
    const filteredGps = gpsList.filter(g => {
        const matchSearch = g.imei.toLowerCase().includes(gpsSearch.toLowerCase()) || g.modelo.toLowerCase().includes(gpsSearch.toLowerCase()) || (g.CLIENTES?.Nombre_Completo || '').toLowerCase().includes(gpsSearch.toLowerCase());
        const matchState = gpsEstadoFilter === 'ALL' || g.estado === gpsEstadoFilter;
        const matchModel = gpsModeloFilter === 'ALL' || g.modelo === gpsModeloFilter;
        return matchSearch && matchState && matchModel;
    });

    const filteredSims = simList.filter(s => {
        const matchSearch = s.numero_telefono.includes(simSearch) || (s.CLIENTES?.Nombre_Completo || '').toLowerCase().includes(simSearch.toLowerCase());
        const matchState = simEstadoFilter === 'ALL' || s.estado === simEstadoFilter;
        const matchCarrier = simOperadoraFilter === 'ALL' || s.operadora === simOperadoraFilter;
        return matchSearch && matchState && matchCarrier;
    });

    // Stats
    const totalGps = gpsList.length;
    const stockGps = gpsList.filter(g => g.estado === 'EN STOCK').length;
    const platGps = gpsList.filter(g => g.estado === 'EN PLATAFORMA').length;
    const damagedGps = gpsList.filter(g => g.estado === 'DAÑADO').length;

    const totalSims = simList.length;
    const stockSims = simList.filter(s => s.estado === 'EN STOCK').length;
    const platSims = simList.filter(s => s.estado === 'EN PLATAFORMA').length;
    const suspSims = simList.filter(s => s.estado === 'SUSPENDIDA').length;
    const tigoSims = simList.filter(s => s.operadora === 'TIGO').length;
    const cwSims = simList.filter(s => s.operadora === 'C&W').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Inventario</h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">Gestión de stock logístico de equipos GPS y líneas celulares.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto p-1 bg-white/5 rounded-2xl border border-white/10">
                    <button
                        onClick={() => setActiveTab('GPS')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'GPS' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                    >
                        <Cpu size={18} /> Equipos GPS
                    </button>
                    <button
                        onClick={() => setActiveTab('SIM')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'SIM' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                    >
                        <Smartphone size={18} /> Tarjetas SIM
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-primary" size={48} />
                </div>
            ) : activeTab === 'GPS' ? (
                // --- VISTA GPS ---
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {/* STATS GPS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Equipos</p>
                            <p className="text-3xl font-black">{totalGps}</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">En Stock</p>
                            <p className="text-3xl font-black text-blue-400">{stockGps}</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-1">En Plataforma</p>
                            <p className="text-3xl font-black text-green-400">{platGps}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Dañados</p>
                            <p className="text-3xl font-black text-red-400">{damagedGps}</p>
                        </div>
                    </div>

                    {/* FILTERS GPS */}
                    <div className="flex flex-col md:flex-row flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[280px] group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar IMEI, modelo o cliente..."
                                value={gpsSearch}
                                onChange={(e) => setGpsSearch(e.target.value)}
                                className="w-full bg-card/40 border border-white/5 rounded-2xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
                            />
                        </div>
                        <select
                            value={gpsEstadoFilter}
                            onChange={e => setGpsEstadoFilter(e.target.value)}
                            className="bg-card/40 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/40 outline-none text-white/90"
                        >
                            <option value="ALL" className="bg-slate-900">Todos los Estados</option>
                            <option value="EN STOCK" className="bg-slate-900">En Stock</option>
                            <option value="EN PLATAFORMA" className="bg-slate-900">En Plataforma</option>
                            <option value="DAÑADO" className="bg-slate-900">Dañados</option>
                        </select>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => exportToCSV(filteredGps, 'GPS_DiacorGPS')}
                                className="bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <Download size={18} /> Exportar
                            </button>
                            <button
                                onClick={() => openGpsModal()}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 whitespace-nowrap"
                            >
                                <Plus size={18} /> Agregar GPS
                            </button>
                        </div>
                    </div>

                    {/* TABLE GPS */}
                    <div className="bg-card/40 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-muted-foreground">
                                        <th className="p-4 font-black">IMEI</th>
                                        <th className="p-4 font-black">Modelo</th>
                                        <th className="p-4 font-black">Estado</th>
                                        <th className="p-4 font-black">Línea (SIM)</th>
                                        <th className="p-4 font-black">Cliente Asignado</th>
                                        <th className="p-4 font-black text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGps.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No se encontraron equipos GPS</td>
                                        </tr>
                                    ) : filteredGps.map(g => (
                                        <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold font-mono text-sm">{g.imei}</td>
                                            <td className="p-4 text-sm">{g.modelo}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full border text-[10px] font-black tracking-widest uppercase ${g.estado === 'EN STOCK' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                    g.estado === 'EN PLATAFORMA' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                        'bg-red-500/10 border-red-500/20 text-red-400'
                                                    }`}>
                                                    {g.estado}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground font-mono">{g.telefono_asignado || '---'}</td>
                                            <td className="p-4 text-sm">{g.CLIENTES?.Nombre_Completo || '---'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => openGpsModal(g)} className="p-2 text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                                                    <Edit3 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                // --- VISTA SIM ---
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    {/* STATS SIM */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total SIMs</p>
                            <p className="text-3xl font-black">{totalSims}</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">En Stock</p>
                            <p className="text-3xl font-black text-blue-400">{stockSims}</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-1">Plataforma</p>
                            <p className="text-3xl font-black text-green-400">{platSims}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Suspendidas</p>
                            <p className="text-3xl font-black text-red-400">{suspSims}</p>
                        </div>
                        <div className="bg-white/5 border border-white/5 p-5 rounded-3xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Por Operadora</p>
                            <div className="flex gap-4 mt-2">
                                <span className="text-sm font-bold text-blue-400">TIGO: {tigoSims}</span>
                                <span className="text-sm font-bold text-orange-400">C&W: {cwSims}</span>
                            </div>
                        </div>
                    </div>

                    {/* FILTERS SIM */}
                    <div className="flex flex-col md:flex-row flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[280px] group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar teléfono o cliente..."
                                value={simSearch}
                                onChange={(e) => setSimSearch(e.target.value)}
                                className="w-full bg-card/40 border border-white/5 rounded-2xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/40 outline-none transition-all placeholder:text-muted-foreground/40"
                            />
                        </div>
                        <select
                            value={simOperadoraFilter}
                            onChange={e => setSimOperadoraFilter(e.target.value)}
                            className="bg-card/40 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/40 outline-none text-white/90"
                        >
                            <option value="ALL" className="bg-slate-900">Todas las Operadoras</option>
                            <option value="TIGO" className="bg-slate-900">TIGO</option>
                            <option value="C&W" className="bg-slate-900">C&W</option>
                            <option value="OTRO" className="bg-slate-900">OTRO</option>
                        </select>
                        <select
                            value={simEstadoFilter}
                            onChange={e => setSimEstadoFilter(e.target.value)}
                            className="bg-card/40 border border-white/5 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/40 outline-none text-white/90"
                        >
                            <option value="ALL" className="bg-slate-900">Todos los Estados</option>
                            <option value="EN STOCK" className="bg-slate-900">En Stock</option>
                            <option value="EN PLATAFORMA" className="bg-slate-900">En Plataforma</option>
                            <option value="SUSPENDIDA" className="bg-slate-900">Suspendidas</option>
                        </select>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => exportToCSV(filteredSims, 'SIMs_DiacorGPS')}
                                className="bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <Download size={18} /> Exportar
                            </button>
                            <button
                                onClick={() => openSimModal()}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 whitespace-nowrap"
                            >
                                <Plus size={18} /> Agregar SIM
                            </button>
                        </div>
                    </div>

                    {/* TABLE SIM */}
                    <div className="bg-card/40 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-muted-foreground">
                                        <th className="p-4 font-black">Teléfono</th>
                                        <th className="p-4 font-black">Operadora</th>
                                        <th className="p-4 font-black">Estado</th>
                                        <th className="p-4 font-black">IMEI Asignado (GPS)</th>
                                        <th className="p-4 font-black">Cliente Asignado</th>
                                        <th className="p-4 font-black text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSims.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No se encontraron líneas SIM</td>
                                        </tr>
                                    ) : filteredSims.map(s => (
                                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold font-mono text-sm">{s.numero_telefono}</td>
                                            <td className="p-4 text-sm font-bold">{s.operadora}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full border text-[10px] font-black tracking-widest uppercase ${s.estado === 'EN STOCK' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                    s.estado === 'EN PLATAFORMA' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                        'bg-red-500/10 border-red-500/20 text-red-400'
                                                    }`}>
                                                    {s.estado}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground font-mono">{s.imei_asignado || '---'}</td>
                                            <td className="p-4 text-sm">{s.CLIENTES?.Nombre_Completo || '---'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => openSimModal(s)} className="p-2 text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                                                    <Edit3 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALES GPS & SIM (OMITIDOS LA MAYORIA DE LA IMPLEMENTACIÓN POR LONGITUD, AQUI ESTA LA LOGICA) */}
            {/* Modal GPS */}
            {isGpsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Cpu className="text-primary" size={24} /> {editingGpsId ? 'Editar Equipo GPS' : 'Registrar Nuevo GPS'}
                            </h3>
                            <button onClick={() => setIsGpsModalOpen(false)} className="text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">IMEI del Equipo *</label>
                                <input type="text" value={gpsForm.imei} onChange={e => setGpsForm({ ...gpsForm, imei: e.target.value })} disabled={!!editingGpsId} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-mono outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Modelo *</label>
                                <input type="text" value={gpsForm.modelo} onChange={e => setGpsForm({ ...gpsForm, modelo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1" placeholder="Ej: FMB920" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado</label>
                                <select value={gpsForm.estado} onChange={e => setGpsForm({ ...gpsForm, estado: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 appearance-none">
                                    <option value="EN STOCK" className="bg-slate-900">EN STOCK</option>
                                    <option value="EN PLATAFORMA" className="bg-slate-900">EN PLATAFORMA</option>
                                    <option value="DAÑADO" className="bg-slate-900">DAÑADO</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Línea SIM Asignada (Opcional)</label>
                                <select value={gpsForm.telefono_asignado} onChange={e => setGpsForm({ ...gpsForm, telefono_asignado: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 font-mono appearance-none">
                                    <option value="" className="bg-slate-900">-- Ninguna SIM --</option>
                                    {simList.filter(s => s.estado !== 'SUSPENDIDA').map(s => (
                                        <option key={s.id} value={s.numero_telefono} className="bg-slate-900">{s.numero_telefono} ({s.operadora})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cliente (Opcional)</label>
                                <select value={gpsForm.cliente_id} onChange={e => setGpsForm({ ...gpsForm, cliente_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 appearance-none">
                                    <option value="" className="bg-slate-900">-- Ninguno --</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id.toString()} className="bg-slate-900">{c.Nombre_Completo}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fecha Instalación (Opcional)</label>
                                <input type="date" value={gpsForm.fecha_instalacion} onChange={e => setGpsForm({ ...gpsForm, fecha_instalacion: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black/20">
                            <button onClick={handleSaveGps} disabled={isSaving} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Guardar GPS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal SIM */}
            {isSimModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Smartphone className="text-primary" size={24} /> {editingSimId ? 'Editar Tarjeta SIM' : 'Registrar Nueva SIM'}
                            </h3>
                            <button onClick={() => setIsSimModalOpen(false)} className="text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Número de Teléfono *</label>
                                <input type="text" value={simForm.numero_telefono} onChange={e => setSimForm({ ...simForm, numero_telefono: e.target.value })} disabled={!!editingSimId} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-mono outline-none focus:ring-2 focus:ring-primary/40 mt-1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operadora</label>
                                <select value={simForm.operadora} onChange={e => setSimForm({ ...simForm, operadora: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 appearance-none">
                                    <option value="TIGO" className="bg-slate-900">TIGO</option>
                                    <option value="C&W" className="bg-slate-900">C&W</option>
                                    <option value="OTRO" className="bg-slate-900">OTRO</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado</label>
                                <select value={simForm.estado} onChange={e => setSimForm({ ...simForm, estado: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 appearance-none">
                                    <option value="EN STOCK" className="bg-slate-900">EN STOCK</option>
                                    <option value="EN PLATAFORMA" className="bg-slate-900">EN PLATAFORMA</option>
                                    <option value="SUSPENDIDA" className="bg-slate-900">SUSPENDIDA</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">GPS Asignado (IMEI) (Opcional)</label>
                                <select value={simForm.imei_asignado} onChange={e => setSimForm({ ...simForm, imei_asignado: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 font-mono appearance-none">
                                    <option value="" className="bg-slate-900">-- Ningún GPS --</option>
                                    {gpsList.filter(g => g.estado !== 'DAÑADO').map(g => (
                                        <option key={g.id} value={g.imei} className="bg-slate-900">{g.imei} ({g.modelo})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cliente (Opcional)</label>
                                <select value={simForm.cliente_id} onChange={e => setSimForm({ ...simForm, cliente_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/40 mt-1 appearance-none">
                                    <option value="" className="bg-slate-900">-- Ninguno --</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id.toString()} className="bg-slate-900">{c.Nombre_Completo}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black/20">
                            <button onClick={handleSaveSim} disabled={isSaving} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Guardar SIM
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
