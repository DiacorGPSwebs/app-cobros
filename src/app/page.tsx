import { Users, Car, CreditCard, Activity } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { name: 'Total Clientes', value: '32', icon: Users, color: 'text-blue-500' },
    { name: 'Vehículos Activos', value: '456', icon: Car, color: 'text-green-500' },
    { name: 'Cobros Pendientes', value: '$1,250', icon: CreditCard, color: 'text-yellow-500' },
    { name: 'Tasa de Pago', value: '94%', icon: Activity, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido, Cesar</h1>
          <p className="text-muted-foreground mt-1">Aquí tienes un resumen de tu sistema de cobros.</p>
        </div>
        <button className="premium-gradient px-4 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 hover:opacity-90 transition-opacity">
          Nuevo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="glass p-6 rounded-2xl card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl bg-white/5`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-8 rounded-2xl">
          <h3 className="text-xl font-bold mb-4">Próximos Vencimientos</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                    C{i}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Cliente Ejemplo {i}</p>
                    <p className="text-xs text-muted-foreground">Vence en 3 días</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">$15.00</p>
                  <p className="text-[10px] uppercase tracking-wider text-yellow-500 font-bold">Pendiente</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 rounded-2xl">
          <h3 className="text-xl font-bold mb-4">Actividad Reciente</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <div>
                  <p className="text-sm">Pago recibido de <span className="font-semibold">Transrios</span></p>
                  <p className="text-xs text-muted-foreground">Hace 2 horas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
