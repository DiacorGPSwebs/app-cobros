'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, FileText, Receipt, LayoutDashboard, Users, UserCircle } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();

    const menuItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Clientes', href: '/clientes', icon: Users },
    ];

    const salesItems = [
        { name: 'Cotizaciones', href: '/cotizaciones', icon: FileText },
        { name: 'Facturas', href: '/facturas', icon: Receipt },
    ];

    const isActive = (path: string) => {
        if (path === '/' && pathname === '/') return true;
        if (path !== '/' && pathname.startsWith(path)) return true;
        return false;
    };

    const linkClass = (path: string) =>
        `flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${isActive(path)
            ? 'bg-primary/10 text-primary font-bold shadow-sm border border-primary/10'
            : 'text-muted-foreground hover:bg-muted hover:text-primary'
        }`;

    const iconClass = (path: string) =>
        `transition-transform duration-200 group-hover:scale-110 ${isActive(path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
        }`;

    return (
        <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-md hidden md:flex flex-col h-screen sticky top-0">
            <div className="p-8">
                <h1 className="text-2xl font-black text-primary tracking-tighter flex items-center gap-2">
                    <div className="w-2 h-8 bg-primary rounded-full" />
                    DIACOR GPS
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                <div className="pb-4">
                    {menuItems.map((item) => (
                        <Link key={item.name} href={item.href} className={linkClass(item.href)}>
                            <item.icon size={20} className={iconClass(item.href)} />
                            <span>{item.name}</span>
                        </Link>
                    ))}
                </div>

                <div className="pt-4 border-t border-border/50">
                    <div className="px-3 pb-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Ventas</div>
                    <div className="space-y-2">
                        {salesItems.map((item) => (
                            <Link key={item.name} href={item.href} className={linkClass(item.href)}>
                                <item.icon size={20} className={iconClass(item.href)} />
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            <div className="p-4 border-t border-border/50 bg-muted/10">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <UserCircle size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">Admin User</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Cobros</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
