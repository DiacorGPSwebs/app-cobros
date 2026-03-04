'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Car, CreditCard, Activity, Clock, Loader2, ArrowRight, DollarSign } from 'lucide-react';
import { format, isAfter, startOfToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const parseLocalDate = (dateString: string) => {
  if (!dateString) return new Date();
  if (dateString.includes('T')) return parseISO(dateString);
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  return new Date(year, month - 1, day);
};

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalClientes: 0,
    vehiculosActivos: 0,
    cobrosPendientes: 0,
    ingresosMes: 0
  });
  const [proximosVencimientos, setProximosVencimientos] = useState<any[]>([]);
  const [actividadReciente, setActividadReciente] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

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
        supabase.from('Cobros').select('*, CLIENTES(Nombre_Completo)').order('fecha_pago', { ascending: false })
      ]);

      const allCobros = cobros || [];

      // Calculate Pending Revenue
      const pendientesList = facturas || [];
      let r_pendientes = 0;

      pendientesList.forEach(fac => {
        const pagos = allCobros.filter(c => c.factura_id === fac.id);
        const pagado = pagos.reduce((sum, c) => sum + (c.monto_pagado || 0), 0);
        r_pendientes += (fac.monto_total - pagado);
      });

      // Calculate Income This Month
      const currentMonthStr = format(new Date(), 'yyyy-MM');
      const ingresosEsteMes = allCobros
        .filter(c => c.fecha_pago?.startsWith(currentMonthStr))
        .reduce((sum, c) => sum + (c.monto_pagado || 0), 0);

      setMetrics({
        totalClientes: totalClientes || 0,
        vehiculosActivos: vehiculosActivos || 0,
        cobrosPendientes: r_pendientes,
        ingresosMes: ingresosEsteMes
      });

      // Process Chart Data (Last 6 months)
      const monthlyData: { [key: string]: number } = {};

      // Initialize last 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = format(d, 'MMM yyyy', { locale: es });
        monthlyData[key] = 0;
      }

      // Aggregate payments
      allCobros.forEach(c => {
        if (!c.fecha_pago) return;
        const date = parseLocalDate(c.fecha_pago);
        const key = format(date, 'MMM yyyy', { locale: es });
        if (monthlyData[key] !== undefined) {
          monthlyData[key] += (c.monto_pagado || 0);
        }
      });

      const formattedChartData = Object.keys(monthlyData).map(key => ({
        name: key.toUpperCase(),
        total: monthlyData[key]
      }));
      setChartData(formattedChartData);

      // Proximos vencimientos
      const dueSoon = pendientesList
        .filter(f => f.fecha_vencimiento)
        .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
        .slice(0, 4);

      setProximosVencimientos(dueSoon);

      // Actividad reciente
      setActividadReciente(allCobros.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { name: 'Ingresos del Mes', value: `$${metrics.ingresosMes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-500' },
    { name: 'Cobros Pendientes', value: `$${metrics.cobrosPendientes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: CreditCard, color: 'text-yellow-500' },
    { name: 'Total Clientes', value: metrics.totalClientes.toString(), icon: Users, color: 'text-blue-500' },
    { name: 'Equipos Activos', value: metrics.vehiculosActivos.toString(), icon: Car, color: 'text-purple-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={48} className="text-primary animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Analizando métricas financieras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Panel Principal</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Inteligencia de negocio y visión general de Diacor GPS.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white/5 border border-white/5 p-6 rounded-3xl backdrop-blur-sm card-hover relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur z-0"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.name}</p>
                <p className="text-3xl font-black mt-2 tracking-tighter text-white">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-4 rounded-2xl bg-${stat.color.split('-')[1]}-500/10 border border-${stat.color.split('-')[1]}-500/20 shadow-inner`}>
                <stat.icon size={28} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="mb-8 relative z-10">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Crecimiento Financiero</p>
          <h3 className="text-2xl font-black text-white">Ingresos vs. Tiempo</h3>
          <p className="text-sm text-muted-foreground font-medium mt-1">Histórico de ingresos capturados en los últimos 6 meses.</p>
        </div>

        <div className="h-[300px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={10}
                tickFormatter={(value) => `$${value}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }}
                itemStyle={{ color: '#3b82f6' }}
                formatter={(value: any) => [`$${(value || 0).toLocaleString()}`, 'Ingresos']}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white"><Clock size={20} className="text-yellow-500" /> Vencimientos Cercanos</h3>
            <Link href="/facturas" className="text-[10px] font-black uppercase tracking-wider text-blue-500 hover:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full transition-colors">Ver todas</Link>
          </div>
          <div className="space-y-4">
            {proximosVencimientos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-medium bg-black/20 rounded-2xl border border-white/5">No hay facturas pendientes.</div>
            ) : (
              proximosVencimientos.map((fac) => {
                const vencimiento = parseLocalDate(fac.fecha_vencimiento);
                const isLate = isAfter(startOfToday(), vencimiento);

                return (
                  <div key={fac.id} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 hover:bg-white/5 transition-colors border border-white/5 group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${isLate ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                        {isLate ? '!' : 'IN'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm uppercase tracking-wider line-clamp-1">{fac.CLIENTES?.Nombre_Completo}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{fac.numero_factura}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-black text-white">${fac.monto_total.toLocaleString()}</p>
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

        <div className="bg-white/5 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white"><Activity size={20} className="text-green-500" /> Pagos Recientes</h3>
          </div>
          <div className="space-y-4">
            {actividadReciente.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-medium bg-black/20 rounded-2xl border border-white/5">Sin actividad reciente.</div>
            ) : (
              actividadReciente.map((cobro) => (
                <div key={cobro.id} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 hover:bg-white/5 transition-colors border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white line-clamp-1">{cobro.CLIENTES?.Nombre_Completo}</p>
                      <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5 uppercase font-medium">{cobro.metodo_pago} &bull; {parseLocalDate(cobro.fecha_pago).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="font-black text-green-400 text-right shrink-0 ml-4">
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
