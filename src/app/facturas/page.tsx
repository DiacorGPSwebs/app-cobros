'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Receipt, Download, Filter, MoreVertical, Eye, CreditCard, Clock, AlertCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function FacturasPage() {
    const [facturas, setFacturas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFactura, setSelectedFactura] = useState<any>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        fetchFacturas();
    }, []);

    const fetchFacturas = async () => {
        try {
            const { data, error } = await supabase
                .from('Facturas')
                .select(`
                    *,
                    CLIENTES (
                        Nombre_Completo,
                        Telefono,
                        Correo
                    ),
                    Cotizaciones (
                        items,
                        numero_cotizacion
                    )
                `)
                .order('fecha_emision', { ascending: false });

            if (error) throw error;
            setFacturas(data || []);
        } catch (err: any) {
            console.error('Error fetching facturas:', err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // PDF HELPER (Robust Method)
    async function handleDownloadPdf(fac: any) {
        try {
            const jsPDF = (await import('jspdf')).default;
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF();
            const date = format(new Date(fac.fecha_emision), 'dd/MM/yyyy');

            // Header
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('FACTURA', 14, 25);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Número: ${fac.numero_factura}`, 14, 33);
            doc.text(`Fecha: ${date}`, 14, 37);
            doc.setFontSize(22);
            doc.text('DIACOR GPS', 140, 28);

            // Client
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('FACTURAR A:', 14, 55);
            doc.setFont('helvetica', 'normal');
            doc.text(fac.CLIENTES?.Nombre_Completo || 'Cliente General', 14, 60);
            doc.text(fac.CLIENTES?.Telefono || 'Teléfono no disp.', 14, 65);

            // Table
            const items = fac.Cotizaciones?.items || [{ description: 'Servicios de Rastreo GPS', quantity: 1, price: fac.monto_subtotal }];
            const tableBody = items.map((item: any) => [
                item.description,
                item.quantity,
                `$${item.price.toFixed(2)}`,
                `$${(item.quantity * item.price).toFixed(2)}`
            ]);

            autoTable(doc, {
                startY: 75,
                head: [['Descripción', 'Cant.', 'Precio', 'Total']],
                body: tableBody,
                headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.text('Subtotal:', 140, finalY);
            doc.text(`$${fac.monto_subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
            doc.text('ITBMS (7%):', 140, finalY + 7);
            doc.text(`$${fac.monto_itbms.toFixed(2)}`, 190, finalY + 7, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL:', 140, finalY + 14);
            doc.text(`$${fac.monto_total.toFixed(2)}`, 190, finalY + 14, { align: 'right' });

            const fileName = `Factura_${fac.numero_factura}.pdf`;
            const pdfBlob = doc.output('blob');
            const url = window.URL.createObjectURL(new Blob([pdfBlob], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err: any) {
            alert('Error al generar PDF: ' + err.message);
        }
    }

    // MODAL Component
    function PreviewModal() {
        if (!isPreviewOpen || !selectedFactura) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white text-slate-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col slide-in-from-bottom-8 duration-500 font-sans">
                    {/* Header Modal */}
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <h2 className="font-bold text-slate-700">Previsualización de Factura</h2>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Invoice Content */}
                    <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-3xl font-black text-blue-600 tracking-tighter">DIACOR GPS</h3>
                                    <p className="text-xs text-slate-500 font-medium">Panamá, Rep. de Panamá</p>
                                    <p className="text-xs text-slate-500">Email: info@diacorgps.com</p>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Factura</h4>
                                    <p className="text-sm font-black text-blue-600">{selectedFactura.numero_factura}</p>
                                    <div className="mt-2 text-[10px] text-slate-400 uppercase font-bold">Fecha de Emisión</div>
                                    <p className="text-sm font-medium">{format(new Date(selectedFactura.fecha_emision), 'dd MMMM, yyyy', { locale: es })}</p>
                                </div>
                            </div>
                            <hr className="border-slate-100" />
                            <div className="grid grid-cols-2 gap-8 text-left">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Facturar a</p>
                                    <p className="font-bold text-slate-800">{selectedFactura.CLIENTES?.Nombre_Completo}</p>
                                    <p className="text-sm text-slate-500">{selectedFactura.CLIENTES?.Correo || selectedFactura.CLIENTES?.Telefono || 'Contacto no reg.'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Estado</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${selectedFactura.estado === 'pagada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {selectedFactura.estado}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-10">
                                <table className="w-full text-left font-sans">
                                    <thead>
                                        <tr className="border-b-2 border-slate-800 text-[10px] font-black uppercase tracking-widest">
                                            <th className="pb-3 text-slate-400">Descripción</th>
                                            <th className="pb-3 text-center text-slate-400 w-16">Cant.</th>
                                            <th className="pb-3 text-right text-slate-400 w-24">Precio</th>
                                            <th className="pb-3 text-right text-slate-400 w-24">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedFactura.Cotizaciones?.items ? (
                                            selectedFactura.Cotizaciones.items.map((item: any, idx: number) => (
                                                <tr key={idx} className="text-sm">
                                                    <td className="py-4 font-medium text-slate-700">{item.description}</td>
                                                    <td className="py-4 text-center text-slate-500">{item.quantity}</td>
                                                    <td className="py-4 text-right text-slate-500">${item.price.toFixed(2)}</td>
                                                    <td className="py-4 text-right font-bold text-slate-800">${(item.quantity * item.price).toFixed(2)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="text-sm">
                                                <td className="py-4 font-medium text-slate-700">Servicio de Rastreo GPS</td>
                                                <td className="py-4 text-center text-slate-500">1</td>
                                                <td className="py-4 text-right text-slate-500">${selectedFactura.monto_subtotal?.toFixed(2)}</td>
                                                <td className="py-4 text-right font-bold text-slate-800">${selectedFactura.monto_subtotal?.toFixed(2)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end pt-6 border-t border-slate-100">
                                <div className="w-[180px] space-y-3">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal</span>
                                        <span className="font-medium">${selectedFactura.monto_subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>ITBMS (7%)</span>
                                        <span className="font-medium">${selectedFactura.monto_itbms?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t-2 border-slate-800 mt-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">Total</span>
                                        <span className="text-xl font-black text-blue-600">${selectedFactura.monto_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                        <button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all font-sans">Cerrar</button>
                        <button onClick={() => { handleDownloadPdf(selectedFactura); setIsPreviewOpen(false); }} className="px-8 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 font-sans">
                            <Download size={18} /> Descargar PDF
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const metrics = {
        pendiente: facturas.filter(f => f.estado === 'pendiente' || f.estado === 'abono').reduce((sum, f) => sum + (f.monto_total - (f.monto_pagado || 0)), 0),
        pagado: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.monto_total, 0),
        vencido: facturas.filter(f => (f.estado === 'pendiente' || f.estado === 'abono') && new Date(f.fecha_vencimiento) < new Date()).reduce((sum, f) => sum + (f.monto_total - (f.monto_pagado || 0)), 0)
    };

    const filteredFacturas = facturas.filter(fac => {
        const query = searchTerm.toLowerCase();
        const matchesSearch = searchTerm === '' ||
            fac.numero_factura.toLowerCase().includes(query) ||
            (fac.CLIENTES?.Nombre_Completo || '').toLowerCase().includes(query);

        const matchesStatus = filterStatus === 'all' || fac.estado === filterStatus || (filterStatus === 'pendiente' && fac.estado === 'abono');

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
                <p className="text-muted-foreground mt-1">Control maestro de facturas y cuentas por cobrar</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card/30 border border-border p-5 rounded-3xl backdrop-blur-sm">
                    <p className="text-sm text-muted-foreground mb-1">Pendiente</p>
                    <p className="text-2xl font-bold text-yellow-500">${metrics.pendiente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-card/30 border border-border p-5 rounded-3xl backdrop-blur-sm">
                    <p className="text-sm text-muted-foreground mb-1">Pagado (Total)</p>
                    <p className="text-2xl font-bold text-green-500">${metrics.pagado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-card/30 border border-border p-5 rounded-3xl backdrop-blur-sm">
                    <p className="text-sm text-muted-foreground mb-1">Vencido</p>
                    <p className="text-2xl font-bold text-red-500">${metrics.vencido.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-card/30 border border-border p-5 rounded-3xl backdrop-blur-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Facturas</p>
                        <p className="text-2xl font-bold">{facturas.length}</p>
                    </div>
                    <Receipt className="text-primary/40" size={32} />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 text-left">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o número de factura..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-card/50 border border-border rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-6 py-4 border rounded-2xl flex items-center gap-2 transition-all font-medium text-sm ${filterStatus !== 'all' ? 'bg-blue-600/10 border-blue-600 text-blue-500' : 'bg-card/50 border-border hover:bg-muted/50'}`}
                    >
                        <Filter size={18} /> {filterStatus === 'all' ? 'Filtrar' : filterStatus === 'pagada' ? 'Pagadas' : 'Pendientes y Abonos'}
                    </button>
                    {showFilters && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 rounded-xl shadow-xl border border-border overflow-hidden z-20 font-sans backdrop-blur-xl">
                            <button onClick={() => { setFilterStatus('all'); setShowFilters(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm border-b border-border text-slate-300">Todas las Facturas</button>
                            <button onClick={() => { setFilterStatus('pendiente'); setShowFilters(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm border-b border-border text-slate-300">Solo Pendientes y Abonos</button>
                            <button onClick={() => { setFilterStatus('pagada'); setShowFilters(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm text-slate-300">Solo Pagadas</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-card/30 border border-border rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border bg-muted/30 text-left">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Factura #</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emisión</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimiento</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monto</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-muted rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredFacturas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground font-sans">
                                        {searchTerm || filterStatus !== 'all' ? 'No se encontraron facturas con estos filtros.' : 'No hay facturas registradas.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredFacturas.map((fac) => (
                                    <tr key={fac.id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                                            {fac.es_electronica && <CreditCard size={14} className="text-blue-400" />}
                                            {fac.numero_factura}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{fac.CLIENTES?.Nombre_Completo}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {format(new Date(fac.fecha_emision), 'dd MMM, yyyy', { locale: es })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5"><Clock size={14} />{fac.fecha_vencimiento ? format(new Date(fac.fecha_vencimiento), 'dd/MM/yyyy') : '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-200">${fac.monto_total.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${fac.estado === 'pagada' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                                {fac.estado.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setSelectedFactura(fac); setIsPreviewOpen(true); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground" title="Ver Previa">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => handleDownloadPdf(fac)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground" title="Descargar PDF">
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PreviewModal />
        </div>
    );
}
