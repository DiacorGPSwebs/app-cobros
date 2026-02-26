'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, FileText, Download, Trash2, Edit3, X, Save, Loader2, Filter, User, Calculator, Receipt, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuoteItem {
    id: string;
    description: string;
    quantity: number;
    price: number;
    hasItbms: boolean;
}

export default function CotizacionesPage() {
    const [cotizaciones, setCotizaciones] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedCotizacion, setSelectedCotizacion] = useState<any>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    // Form State
    const [selectedCliente, setSelectedCliente] = useState<{ id: number, nombre: string } | null>(null);
    const [prospectName, setProspectName] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([
        { id: Math.random().toString(), description: '', quantity: 1, price: 0, hasItbms: true }
    ]);

    // Client Search State
    const [clientSearch, setClientSearch] = useState('');
    const [clientResults, setClientResults] = useState<any[]>([]);
    const [isSearchingClients, setIsSearchingClients] = useState(false);

    useEffect(() => {
        fetchCotizaciones();
    }, []);

    const fetchCotizaciones = async () => {
        try {
            const { data, error } = await supabase
                .from('Cotizaciones')
                .select(`
                    *,
                    CLIENTES (
                        Nombre_Completo
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCotizaciones(data || []);
        } catch (err: any) {
            console.error('Error fetching cotizaciones:', err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchClients = async (term: string) => {
        setClientSearch(term);
        if (term.length < 2) {
            setClientResults([]);
            return;
        }
        setIsSearchingClients(true);
        try {
            const { data, error } = await supabase
                .from('CLIENTES')
                .select('id, Nombre_Completo')
                .ilike('Nombre_Completo', `%${term}%`)
                .limit(5);
            if (error) throw error;
            setClientResults(data || []);
        } catch (err) {
            console.error('Error searching clients:', err);
        } finally {
            setIsSearchingClients(false);
        }
    };

    const addItem = () => {
        setItems([...items, { id: Math.random().toString(), description: '', quantity: 1, price: 0, hasItbms: true }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let itbms = 0;

        items.forEach(item => {
            const lineTotal = item.quantity * item.price;
            subtotal += lineTotal;
            if (item.hasItbms) {
                itbms += lineTotal * 0.07;
            }
        });

        return { subtotal, itbms, total: subtotal + itbms };
    };

    const handleSaveQuote = async () => {
        if (!selectedCliente && !prospectName) {
            alert('Por favor selecciona un cliente o ingresa el nombre de un prospecto.');
            return;
        }

        const { subtotal, itbms, total } = calculateTotals();
        setIsSaving(true);

        try {
            const quoteData = {
                cliente_id: selectedCliente?.id || null,
                nombre_prospecto: selectedCliente ? null : prospectName,
                items: items,
                monto_subtotal: subtotal,
                monto_itbms: itbms,
                monto_total: total,
                estado: 'borrador'
            };

            if (isEditing && editingId) {
                const { error } = await supabase
                    .from('Cotizaciones')
                    .update(quoteData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('Cotizaciones')
                    .insert({
                        ...quoteData,
                        numero_cotizacion: `COT-${format(new Date(), 'yyyyMMddHHmmss')}` // Simple generator if no trigger
                    });
                if (error) throw error;
            }

            alert(isEditing ? 'Cotización actualizada exitosamente.' : 'Cotización guardada exitosamente.');
            setIsModalOpen(false);
            fetchCotizaciones();
            resetForm();
        } catch (err: any) {
            alert('Error al guardar cotización: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditQuote = (cot: any) => {
        setIsEditing(true);
        setEditingId(cot.id);
        setSelectedCliente(cot.CLIENTES ? { id: cot.cliente_id, nombre: cot.CLIENTES.Nombre_Completo } : null);
        setProspectName(cot.nombre_prospecto || '');
        setItems(cot.items.map((item: any) => ({
            ...item,
            id: item.id || Math.random().toString()
        })));
        setIsModalOpen(true);
    };

    const handleDeleteQuote = async (id: string) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('Cotizaciones')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setConfirmingDeleteId(null);
            fetchCotizaciones();
            alert('Cotización eliminada exitosamente.');
        } catch (err: any) {
            alert('Error al eliminar cotización: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = (cot: any) => {
        try {
            if (!cot || !cot.items) {
                alert('No hay datos suficientes para generar el PDF.');
                return;
            }

            const doc = new jsPDF();
            const clientName = cot.CLIENTES?.Nombre_Completo || cot.nombre_prospecto || 'Cliente General';
            const date = cot.fecha_emision ? format(new Date(cot.fecha_emision), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');
            const quoteNumber = cot.numero_cotizacion || 'S/N';

            // Styles
            const primaryColor = [37, 99, 235]; // #2563eb

            // Header
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN', 14, 25);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Número: ${quoteNumber}`, 14, 33);
            doc.text(`Fecha: ${date}`, 14, 37);

            // Company Name
            doc.setFontSize(22);
            doc.text('DIACOR GPS', 140, 28);

            // Client Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA PARA:', 14, 55);

            doc.setFont('helvetica', 'normal');
            doc.text(clientName, 14, 60);
            doc.text('Panamá, Rep. de Panamá', 14, 65);

            // Prepare Table Data
            const tableBody = cot.items.map((item: any) => [
                item.description || 'Sin descripción',
                item.quantity || 0,
                `$${parseFloat((item.price || 0).toString()).toFixed(2)}`,
                item.hasItbms ? '7%' : '0%',
                `$${((item.quantity || 0) * (item.price || 0)).toFixed(2)}`
            ]);

            // Table
            autoTable(doc, {
                startY: 75,
                head: [['Descripción', 'Cant.', 'Precio Unit.', 'ITBMS', 'Subtotal']],
                body: tableBody,
                headStyles: { fillColor: primaryColor as any, textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { left: 14, right: 14 },
                theme: 'striped'
            });

            // Totals
            const lastTable = (doc as any).lastAutoTable;
            const finalY = lastTable ? lastTable.finalY + 10 : 85;

            // Check if we need a new page for totals
            let currentY = finalY;
            if (finalY > 260) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('Subtotal:', 140, currentY);
            doc.text(`$${(cot.monto_subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, currentY, { align: 'right' });

            doc.text('ITBMS (7%):', 140, currentY + 7);
            doc.text(`$${(cot.monto_itbms || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, currentY + 7, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('TOTAL FINAL:', 140, currentY + 15);
            doc.text(`$${(cot.monto_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, currentY + 15, { align: 'right' });

            // Footer
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text('Gracias por su confianza. Esta cotización tiene una validez de 15 días.', 105, 285, { align: 'center' });

            // Final check on filename
            const safeNumber = (cot.numero_cotizacion || 'S_N').replace(/[^a-z0-9]/gi, '_');
            const fileName = `Cotizacion_${safeNumber}.pdf`;

            // FORCE DOWNLOAD STRATEGY
            // Using octet-stream to tell the browser "this is a file, don't try to open it"
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

            console.log("Descarga forzada iniciada para:", fileName);
        } catch (error: any) {
            console.error('Error al generar PDF:', error);
            alert('Error al generar el PDF: ' + error.message);
        }
    };

    const handleCreateInvoice = async (quote: any) => {
        if (!quote.cliente_id) {
            alert('Esta cotización es de un prospecto. Primero debes registrarlo como cliente.');
            return;
        }

        if (!confirm(`¿Estás seguro de convertir la cotización ${quote.numero_cotizacion} en una factura oficial?`)) return;

        setIsLoading(true);
        try {
            // 1. Create Invoice
            const { error: fError } = await supabase
                .from('Facturas')
                .insert({
                    cliente_id: quote.cliente_id,
                    cotizacion_id: quote.id,
                    monto_subtotal: quote.monto_subtotal,
                    monto_itbms: quote.monto_itbms,
                    monto_total: quote.monto_total,
                    estado: 'pendiente'
                });

            if (fError) throw fError;

            // 2. Update Quote Status
            const { error: qError } = await supabase
                .from('Cotizaciones')
                .update({ estado: 'facturada' })
                .eq('id', quote.id);

            if (qError) throw qError;

            alert('Factura generada exitosamente. La encontrarás en el módulo de Facturación.');
            fetchCotizaciones();
        } catch (err: any) {
            alert('Error al facturar: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedCliente(null);
        setProspectName('');
        setItems([{ id: Math.random().toString(), description: '', quantity: 1, price: 0, hasItbms: true }]);
        setClientSearch('');
        setIsEditing(false);
        setEditingId(null);
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
                    <p className="text-muted-foreground mt-1">Gestión de propuestas comerciales y presupuestos</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                    <Plus size={20} /> Nueva Cotización
                </button>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o número de cotización..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-card/50 border border-border rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-card/50 border border-border rounded-2xl py-4 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground">
                        <Filter size={18} /> Filtrar
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-card/50 border border-border rounded-2xl py-4 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground">
                        <Download size={18} /> Exportar
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card/30 border border-border rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente / Prospecto</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fecha</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monto Total</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-muted rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : cotizaciones.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        No se encontraron cotizaciones registradas.
                                    </td>
                                </tr>
                            ) : (
                                cotizaciones.map((cot) => (
                                    <tr key={cot.id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-6 py-4 font-medium">{cot.numero_cotizacion}</td>
                                        <td className="px-6 py-4">
                                            {cot.CLIENTES?.Nombre_Completo || cot.nombre_prospecto}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {format(new Date(cot.fecha_emision), 'dd MMM, yyyy', { locale: es })}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">
                                            ${cot.monto_total.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${cot.estado === 'aceptada' ? 'bg-green-500/10 text-green-500' :
                                                cot.estado === 'rechazada' ? 'bg-red-500/10 text-red-500' :
                                                    cot.estado === 'facturada' ? 'bg-blue-500/10 text-blue-500' :
                                                        'bg-yellow-500/10 text-yellow-500'
                                                }`}>
                                                {cot.estado.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {cot.estado === 'aceptada' && (
                                                    <button
                                                        onClick={() => handleCreateInvoice(cot)}
                                                        className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-all text-xs font-bold"
                                                    >
                                                        <Receipt size={14} /> FACTURAR
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setSelectedCotizacion(cot); setIsPreviewOpen(true); }}
                                                    className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-all"
                                                    title="Ver Previa"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditQuote(cot)}
                                                    className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPdf(cot)}
                                                    className="p-2 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-500 transition-all font-bold flex items-center gap-1"
                                                    title="Descargar PDF (Fix Final)"
                                                >
                                                    <Download size={16} /> PDF
                                                </button>

                                                {confirmingDeleteId === cot.id ? (
                                                    <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300">
                                                        <button
                                                            onClick={() => handleDeleteQuote(cot.id)}
                                                            className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-600 transition-all"
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmingDeleteId(null)}
                                                            className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmingDeleteId(cot.id)}
                                                        className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card border border-border w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col slide-in-from-bottom-8 duration-500">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight">{isEditing ? 'Editar Cotización' : 'Crear Nueva Cotización'}</h2>
                                    <p className="text-xs text-muted-foreground">Completa los datos para generar la propuesta</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                                className="p-2 hover:bg-muted rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar text-left">
                            {/* Section 1: Client Selection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                    <User size={14} /> Información del Cliente
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="text-xs text-muted-foreground ml-1 mb-1.5 block font-bold uppercase tracking-widest">Buscar Cliente Existente</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Nombre del cliente..."
                                                value={selectedCliente ? selectedCliente.nombre : clientSearch}
                                                onChange={(e) => handleSearchClients(e.target.value)}
                                                disabled={!!selectedCliente}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-sans"
                                            />
                                            {selectedCliente && (
                                                <button
                                                    onClick={() => { setSelectedCliente(null); setClientSearch(''); }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-400"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {isSearchingClients && (
                                            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl p-4 text-center shadow-2xl">
                                                <Loader2 className="animate-spin mx-auto text-primary" size={20} />
                                            </div>
                                        )}
                                        {!selectedCliente && clientResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-border rounded-xl shadow-2xl p-1 overflow-hidden">
                                                {clientResults.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => {
                                                            setSelectedCliente({ id: c.id, nombre: c.Nombre_Completo });
                                                            setClientResults([]);
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-primary/10 rounded-lg text-sm transition-colors border-b border-white/5 last:border-0"
                                                    >
                                                        {c.Nombre_Completo}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-muted-foreground ml-1 mb-1.5 block font-bold uppercase tracking-widest">O Nombre de Prospecto (Nuevo)</label>
                                        <input
                                            type="text"
                                            placeholder="Nombre completo..."
                                            value={prospectName}
                                            onChange={(e) => setProspectName(e.target.value)}
                                            disabled={!!selectedCliente}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50 font-sans"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Line Items */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Calculator size={14} /> Ítems y Conceptos
                                    </h3>
                                    <button
                                        onClick={addItem}
                                        className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-xl hover:bg-primary/20 transition-all font-bold uppercase tracking-widest flex items-center gap-1.5"
                                    >
                                        <Plus size={14} /> Agregar Línea
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {items.map((item, index) => (
                                        <div key={item.id} className="grid grid-cols-12 gap-3 items-center group animate-in slide-in-from-right-2 duration-300 bg-card/50 p-3 rounded-2xl border border-border/50">
                                            <div className="col-span-6">
                                                <input
                                                    type="text"
                                                    placeholder="Descripción del servicio o producto..."
                                                    value={item.description}
                                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary/40 outline-none font-sans"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-2 text-sm text-center focus:ring-1 focus:ring-primary/40 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-5 pr-2 text-sm focus:ring-1 focus:ring-primary/40 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2 justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.hasItbms}
                                                    onChange={(e) => updateItem(item.id, 'hasItbms', e.target.checked)}
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5"
                                                />
                                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">ITBMS</span>
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    disabled={items.length === 1}
                                                    className="p-2.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all disabled:opacity-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Totals */}
                        <div className="p-6 bg-muted/20 border-t border-border flex items-center justify-between">
                            <div className="flex gap-10">
                                <div className="text-left">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Subtotal</p>
                                    <p className="text-xl font-medium">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">ITBMS (7%)</p>
                                    <p className="text-xl font-medium text-blue-400">${totals.itbms.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-left border-l border-white/10 pl-10">
                                    <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-1">Total Propuesto</p>
                                    <p className="text-3xl font-black text-primary">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                                    className="px-8 py-3.5 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-bold text-sm uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveQuote}
                                    disabled={isSaving}
                                    className="px-10 py-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    {isEditing ? 'Actualizar' : 'Guardar Cotización'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {isPreviewOpen && selectedCotizacion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white text-slate-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col slide-in-from-bottom-8 duration-500 font-sans">
                        {/* Header Modal */}
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="font-bold text-slate-700">Previsualización de Cotización</h2>
                            <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white text-left">
                            <div className="max-w-2xl mx-auto space-y-8">
                                {/* Quote Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-3xl font-black text-blue-600 tracking-tighter">DIACOR GPS</h3>
                                        <p className="text-xs text-slate-500 font-medium">Panamá, Rep. de Panamá</p>
                                        <p className="text-xs text-slate-500">Email: info@diacorgps.com</p>
                                    </div>
                                    <div className="text-right">
                                        <h4 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Cotización</h4>
                                        <p className="text-sm font-black text-blue-600">{selectedCotizacion.numero_cotizacion}</p>
                                        <div className="mt-2 text-[10px] text-slate-400 uppercase font-black tracking-widest">Fecha</div>
                                        <p className="text-sm font-bold">{format(new Date(selectedCotizacion.fecha_emision || new Date()), 'dd MMMM, yyyy', { locale: es })}</p>
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                {/* Client Info */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Propuesta para</p>
                                        <p className="font-bold text-slate-800 text-lg">{selectedCotizacion.CLIENTES?.Nombre_Completo || selectedCotizacion.nombre_prospecto}</p>
                                        <p className="text-sm text-slate-500">Panamá, Rep. de Panamá</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Estado</p>
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${selectedCotizacion.estado === 'facturada' ? 'bg-blue-100 text-blue-600' :
                                            selectedCotizacion.estado === 'aceptada' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                                            }`}>
                                            {selectedCotizacion.estado}
                                        </span>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="mt-8">
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
                                            {selectedCotizacion.items?.map((item: any, idx: number) => (
                                                <tr key={idx} className="text-sm">
                                                    <td className="py-4 font-medium text-slate-700">{item.description}</td>
                                                    <td className="py-4 text-center text-slate-500">{item.quantity}</td>
                                                    <td className="py-4 text-right text-slate-500">${parseFloat(item.price).toFixed(2)}</td>
                                                    <td className="py-4 text-right font-bold text-slate-800">${(item.quantity * item.price).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end pt-6 border-t border-slate-100">
                                    <div className="w-[200px] space-y-3">
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Subtotal</span>
                                            <span className="font-bold text-slate-700">${selectedCotizacion.monto_subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>ITBMS (7%)</span>
                                            <span className="font-bold text-blue-600">${selectedCotizacion.monto_itbms?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between pt-4 border-t-2 border-slate-800 mt-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-900">Total Propuesto</span>
                                            <span className="text-2xl font-black text-blue-600">${selectedCotizacion.monto_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-16 text-center">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Validez de la oferta: 15 días calendario</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    handleDownloadPdf(selectedCotizacion);
                                    setIsPreviewOpen(false);
                                }}
                                className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                            >
                                <Download size={18} /> Descargar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
