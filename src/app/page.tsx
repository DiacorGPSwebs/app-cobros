'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Car, CreditCard, Activity, Clock, Loader2, ArrowRight } from 'lucide-react';
import { format, isAfter, addDays, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

// Reusa la función de parsing local del page de clientes
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  return new Date(year, month - 1, day);
};

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalClientes: 0,
    vehiculosActivos: 0,
    cobrosPendientes: 0,
    tasaPago: 0
  });
  const [proximosVencimientos, setProximosVencimientos] = useState<any[]>([]);
  const [actividadReciente, setActividadReciente] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch Basics
      const [
        { count: totalClientes },
        { count: vehiculosActivos },
        { data: facturas },
        { data: cobros }
      ] = await Promise.all([
        supabase.from('CLIENTES').select('*', { count: 'exact', head: true }),
        supabase.from('Vehiculos').select('*', { count: 'exact', head: true }),
        supabase.from('Facturas').select('*, CLIENTES(Nombre_Completo)').in('estado', ['pendiente', 'abono']),
        supabase.from('Cobros').select('*, CLIENTES(Nombre_Completo)').order('fecha_pago', { ascending: false }).limit(5)
      ]);

      // Calculate Pending Revenue
      const pendientesList = facturas || [];
      let r_pendientes = 0;

      // Re-fetch all payments for accurate partial payment calculation
      const { data: allCobros } = await supabase.from('Cobros').select('factura_id, monto_pagado');

      pendientesList.forEach(fac => {
        const pagos = (allCobros || []).filter(c => c.factura_id === fac.id);
        const pagado = pagos.reduce((sum, c) => sum + c.monto_pagado, 0);
        r_pendientes += (fac.monto_total - pagado);
      });

      // Very raw estimate of payment rate based on ratio of paid to pending this month
      // We'll skip complex math and just use a placeholder logic or 100% since calculating real conversion rate requires deeply querying all historical invoices. 
      // We'll show an estimate. Let's say: [Paid this month] / ([Paid this month] + [Pending total]) for simplicity.
      const { data: facturasPagadas } = await supabase.from('Facturas').select('id').eq('estado', 'pagada');
      const totalPagadasCount = facturasPagadas?.length || 0;
      const totalPendientesCount = pendientesList.length || 0;
      const t_pago = totalPagadasCount + totalPendientesCount > 0
        ? Math.round((totalPagadasCount / (totalPagadasCount + totalPendientesCount)) * 100)
        : 100;

      setMetrics({
        totalClientes: totalClientes || 0,
        vehiculosActivos: vehiculosActivos || 0,
        cobrosPendientes: r_pendientes,
        tasaPago: t_pago
      });

      // Proximos vencimientos (Sort by closest due date)
      const dueSoon = pendientesList
        .filter(f => f.fecha_vencimiento)
        .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
        .slice(0, 4);

      setProximosVencimientos(dueSoon);

      // Actividad reciente
      setActividadReciente(cobros || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { name: 'Total Clientes', value: metrics.totalClientes.toString(), icon: Users, color: 'text-blue-500' },
    { name: 'Vehículos Activos', value: metrics.vehiculosActivos.toString(), icon: Car, color: 'text-green-500' },
    { name: 'Cobros Pendientes', value: `$${metrics.cobrosPendientes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: CreditCard, color: 'text-yellow-500' },
    { name: 'Tasa de Cumplimiento', value: `${metrics.tasaPago}%`, icon: Activity, color: 'text-purple-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={48} className="text-primary animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Sincronizando métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel Principal</h1>
          <p className="text-muted-foreground mt-1">Visión general en tiempo real de tu cartera.</p>
        </div>
        <Link href="/clientes" className="premium-gradient px-4 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 hover:opacity-90 transition-opacity flex items-center gap-2 text-white">
          Ver Clientes <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-card/30 border border-border p-6 rounded-3xl backdrop-blur-sm card-hover relative overflow-hidden group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur z-0"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{stat.name}</p>
                <p className="text-3xl font-black mt-2 tracking-tighter shadow-sm">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner`}>
                <stat.icon size={28} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card/30 border border-border p-8 rounded-3xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Clock size={20} className="text-yellow-500" /> Vencimientos Cercanos</h3>
            <Link href="/facturas" className="text-xs font-bold uppercase tracking-wider text-blue-500 hover:text-blue-400">Ver todas</Link>
          </div>
          <div className="space-y-4">
            {proximosVencimientos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-medium">No hay facturas pendientes.</div>
            ) : (
              proximosVencimientos.map((fac) => {
                const vencimiento = parseLocalDate(fac.fecha_vencimiento);
                const isLate = isAfter(startOfToday(), vencimiento);

                return (
                  <div key={fac.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${isLate ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                        IN
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm uppercase tracking-wider">{fac.CLIENTES?.Nombre_Completo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fac.numero_factura}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-foreground">${fac.monto_total.toLocaleString()}</p>
                      <p className={`text-[10px] uppercase tracking-widest font-black mt-1 ${isLate ? 'text-red-500' : 'text-yellow-500'}`}>
                        {isLate ? 'Vencida' : format(vencimiento, 'dd MMM', { locale: es })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-card/30 border border-border p-8 rounded-3xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Activity size={20} className="text-green-500" /> Pagos Recientes</h3>
          </div>
          <div className="space-y-4">
            {actividadReciente.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-medium">Sin actividad reciente.</div>
            ) : (
              actividadReciente.map((cobro) => (
                <div key={cobro.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">Pago de <span className="font-black text-white">{cobro.CLIENTES?.Nombre_Completo}</span></p>
                    <p className="text-xs text-muted-foreground tracking-wide mt-1 uppercase">{cobro.metodo_pago} &bull; {parseLocalDate(cobro.fecha_pago).toLocaleDateString()}</p>
                  </div>
                  <div className="font-black text-green-400">
                    +${cobro.monto_pagado.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
