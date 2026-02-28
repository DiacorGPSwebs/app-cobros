'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Phone, Mail, Calendar, CreditCard, Search, X, ShieldCheck, Car, ChevronRight, Calculator, Save, Edit3, Loader2, Plus, Trash2, Clock, RefreshCw, FileText, Receipt, Upload, ExternalLink, Check } from 'lucide-react';
import { format, addMonths, isAfter, setDate, startOfToday, subMonths, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cliente {
    id: number;
    Nombre_Completo: string;
    Telefono: string;
    Correo: string;
    Tarifa: number;
    Plan: string;
    Dia_De_Pago: number;
    Cantidad_Vehiculo: number;
    Requiere_Factura: boolean;
    Fecha_Ultimo_Pago?: string;
    total_deuda?: number;
    tiene_mora?: boolean;
}

interface UsuarioGPS {
    id: number;
    Usuario: string;
}

interface Vehiculo {
    id: number;
    Placas: string;
    Fecha_Anualidad: string;
    Usuario_ID: number;
}

interface Cobro {
    id: string;
    monto_pagado: number;
    fecha_pago: string;
    periodo_cubierto: string;
    metodo_pago: string;
    factura_id?: string;
}

interface Factura {
    id: string;
    numero_factura: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
    estado: 'pendiente' | 'pagada' | 'abono' | 'anulada';
    archivo_url?: string;
    pagos_vincunlados?: Cobro[];
    saldo_pendiente?: number;
    periodo?: string;
}

export default function ClientesPage() {
    const formatDateLocal = (dateStr?: string, formatStr: string = 'dd/MM/yyyy') => {
        if (!dateStr) return '';
        const date = parseLocalDate(dateStr);
        return format(date, formatStr, { locale: es });
    };

    const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        if (parts.length !== 3) return new Date(dateStr);
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        return new Date(y, m, d);
    };

    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [extraData, setExtraData] = useState<{ usuarios: UsuarioGPS[], vehiculos: Vehiculo[], cobros: Cobro[] }>({ usuarios: [], vehiculos: [], cobros: [] });
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDocuments, setShowDocuments] = useState(false);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [clientDocs, setClientDocs] = useState<{ cotizaciones: any[], facturas: Factura[] }>({ cotizaciones: [], facturas: [] });
    const [pendingInvoices, setPendingInvoices] = useState<Factura[]>([]);

    const [invoiceFormData, setInvoiceFormData] = useState({
        numero: '',
        monto: 0,
        meses: 1,
        periodos: [] as { label: string, date: Date }[],
        meses_detallados: [] as { label: string, date: Date, equipos: number, monto: number }[],
        desde_mes: format(subMonths(new Date(), 2), 'yyyy-MM'),
        fecha_emision: format(new Date(), 'yyyy-MM-dd'),
        fecha_vencimiento: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
        es_electronica: false
    });

    const [editFormData, setEditFormData] = useState<Partial<Cliente>>({});
    const [editUsuarios, setEditUsuarios] = useState<UsuarioGPS[]>([]);
    const [editVehiculos, setEditVehiculos] = useState<Vehiculo[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    // New Payment state
    const [paymentFormData, setPaymentFormData] = useState({
        monto: 0,
        metodo: 'Efectivo',
        periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
        fecha: format(new Date(), 'yyyy-MM-dd'),
        factura_id: '' as string | null,
        recibo_file: null as File | null
    });

    const [isSyncing, setIsSyncing] = useState(false);
    const [allUnlinkedUsers, setAllUnlinkedUsers] = useState<UsuarioGPS[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmingDeleteClient, setIsConfirmingDeleteClient] = useState(false);
    const [confirmingDeleteUsuarioId, setConfirmingDeleteUsuarioId] = useState<number | null>(null);
    const [confirmingDeleteVehiculoId, setConfirmingDeleteVehiculoId] = useState<number | null>(null);
    const [confirmingDeleteInvoiceId, setConfirmingDeleteInvoiceId] = useState<string | null>(null);
    const [confirmingDeleteCotizacionId, setConfirmingDeleteCotizacionId] = useState<string | null>(null);
    const [confirmingDeleteCobroId, setConfirmingDeleteCobroId] = useState<string | null>(null);

    useEffect(() => {
        fetchClientes();
    }, []);

    // Helper to calculate next payment date for monthly clients
    const getNextMonthlyPaymentDate = (dia: number) => {
        const today = startOfToday();
        let paymentDate = setDate(today, dia);

        if (isAfter(today, paymentDate)) {
            paymentDate = addMonths(paymentDate, 1);
        }

        return format(paymentDate, 'dd/MM/yyyy', { locale: es });
    };

    const getNextInvoiceNumber = async () => {
        try {
            const { data, error } = await supabase
                .from('Facturas')
                .select('numero_factura')
                .order('numero_factura', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) {
                return 'FAC-0001';
            }

            const lastNum = data[0].numero_factura;
            const match = lastNum.match(/\d+/);
            if (match) {
                const nextNum = parseInt(match[0]) + 1;
                return `FAC-${nextNum.toString().padStart(4, '0')}`;
            }

            return 'FAC-0001';
        } catch (err) {
            console.error('Error getting next invoice number:', err);
            return 'FAC-0001';
        }
    };

    const detectOwedPeriods = (cliente: Cliente, facturas: Factura[], customStartDate?: Date) => {
        const today = startOfToday();
        const paymentDay = cliente.Dia_De_Pago || 1;

        let startDate;
        if (customStartDate) {
            startDate = customStartDate;
        } else if (cliente.Fecha_Ultimo_Pago) {
            startDate = addMonths(parseLocalDate(cliente.Fecha_Ultimo_Pago), 1);
        } else {
            // Fallback: Buscar la última factura
            const lastInvoice = facturas.length > 0
                ? facturas.reduce((latest, current) =>
                    isAfter(parseLocalDate(current.fecha_emision), parseLocalDate(latest.fecha_emision)) ? current : latest
                )
                : null;

            if (lastInvoice) {
                startDate = addMonths(parseLocalDate(lastInvoice.fecha_emision), 1);
            } else {
                return [];
            }
        }

        startDate = setDate(startDate, paymentDay);

        // Generar lista de meses desde startDate hasta today
        const owed: any[] = [];
        try {
            const startM = startOfMonth(startDate);
            const todayM = startOfMonth(today);

            if (isAfter(startM, todayM)) {
                return [];
            }

            const intervals = eachMonthOfInterval({
                start: startM,
                end: todayM
            });

            intervals.forEach(date => {
                const billingDate = setDate(date, paymentDay);
                // Solo es deuda si la billingDate es hoy o en el pasado
                if (!isAfter(billingDate, today)) {
                    owed.push({
                        label: format(billingDate, 'MMMM yyyy', { locale: es }),
                        date: billingDate
                    });
                }
            });
            return owed;
        } catch (e) {
            return [];
        }
    };

    const fetchClientes = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('CLIENTES')
                .select('*, Fecha_Ultimo_Pago')
                .order('Nombre_Completo', { ascending: true });
            if (error) throw error;

            // Fetch all invoices to calculate debt per client
            const { data: allInvoices } = await supabase.from('Facturas').select('id, cliente_id, monto_total, fecha_emision, estado');
            const { data: allPayments } = await supabase.from('Cobros').select('monto_pagado, factura_id');

            const clientesConDeuda = (data || []).map(c => {
                const clientInvoices = (allInvoices || []).filter(f => f.cliente_id === c.id);
                let totalDeuda = 0;
                let tieneMora = false;

                clientInvoices.forEach(f => {
                    const pagos = (allPayments || []).filter(p => p.factura_id === f.id);
                    const totalPagado = pagos.reduce((acc, p) => acc + p.monto_pagado, 0);
                    const saldo = f.monto_total - totalPagado;

                    if (saldo > 0) {
                        totalDeuda += saldo;
                        // Mora check: > 60 days
                        if (isAfter(startOfToday(), addMonths(parseLocalDate(f.fecha_emision), 2))) {
                            tieneMora = true;
                        }
                    }
                });

                return { ...c, total_deuda: totalDeuda, tiene_mora: tieneMora };
            });

            setClientes(clientesConDeuda);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDetails = async (clienteId: number) => {
        setIsLoadingDetails(true);
        try {
            const { data: usuarios, error: uError } = await supabase
                .from('Usuarios')
                .select('id, Usuario')
                .eq('CLIENTE_ID', clienteId);

            if (uError) throw uError;

            const userIds = (usuarios || []).map(u => u.id);
            let vehiculos: Vehiculo[] = [];

            if (userIds.length > 0) {
                const { data: vData, error: vError } = await supabase
                    .from('Vehiculos')
                    .select('id, Placas, Fecha_Anualidad, Usuario_ID')
                    .in('Usuario_ID', userIds);
                if (vError) throw vError;
                vehiculos = vData || [];
            }

            setExtraData({ usuarios: usuarios || [], vehiculos, cobros: [] });
            setEditUsuarios(usuarios || []);
            setEditVehiculos(vehiculos);

            // Fetch Cobros
            const { data: cobros, error: cError } = await supabase
                .from('Cobros')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('fecha_pago', { ascending: false });

            if (!cError) {
                setExtraData(prev => ({ ...prev, cobros: cobros || [] }));
            }

            // Fetch Documents (Quotations & Invoices)
            const { data: cots } = await supabase.from('Cotizaciones').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false });
            const { data: facs } = await supabase.from('Facturas').select('*').eq('cliente_id', clienteId).order('fecha_emision', { ascending: false });

            // Calculate balances for each invoice
            const facturasConSaldo = (facs || []).map(f => {
                const pagos = (cobros || []).filter(c => c.factura_id === f.id);
                const totalPagado = pagos.reduce((acc, p) => acc + p.monto_pagado, 0);
                const saldo = f.monto_total - totalPagado;

                // Deterministic state based on actual balance
                let estadoCalculado = f.estado;
                if (saldo <= 0) estadoCalculado = 'pagada';
                else if (totalPagado > 0) estadoCalculado = 'abono';
                else estadoCalculado = 'pendiente';

                return {
                    ...f,
                    pagos_vincunlados: pagos,
                    saldo_pendiente: saldo,
                    estado: estadoCalculado
                };
            });

            setClientDocs({ cotizaciones: cots || [], facturas: facturasConSaldo });

            // Pending Invoices for payment registration (now including 'abono')
            setPendingInvoices(facturasConSaldo.filter(f => f.estado === 'pendiente' || f.estado === 'abono'));
        } catch (err: any) {
            console.error('Error fetching details:', err);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const addEmptyUsuario = () => {
        const newId = -Date.now();
        setEditUsuarios(prev => [...prev, { id: newId, Usuario: '', CLIENTE_ID: selectedCliente?.id || 0 }]);
    };

    const addEmptyVehiculo = (usuarioId: number) => {
        const newId = -Date.now();
        setEditVehiculos(prev => [...prev, {
            id: newId,
            Placas: '',
            Fecha_Anualidad: new Date().toISOString().split('T')[0],
            Usuario_ID: usuarioId
        }]);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                alert(`Sincronización completada: ${result.summary.users} usuarios y ${result.summary.devices} dispositivos.`);
                fetchClientes(); // Refresh list
            } else {
                alert('Error en la sincronización: ' + result.error);
            }
        } catch (err: any) {
            alert('Error al conectar con el servidor: ' + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchUnlinkedUsers = async (term?: string) => {
        const queryTerm = term !== undefined ? term : userSearchTerm;
        if (queryTerm.length < 3) return;
        setIsSearchingUsers(true);
        try {
            const { data, error } = await supabase
                .from('Usuarios')
                .select('id, Usuario')
                .is('CLIENTE_ID', null)
                .ilike('Usuario', `%${queryTerm}%`)
                .order('Usuario', { ascending: true })
                .limit(20);
            if (error) throw error;
            setAllUnlinkedUsers(data || []);
        } catch (err: any) {
            console.error('Error fetching unlinked users:', err.message);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const linkUserToCliente = async (usuarioId: number) => {
        if (!selectedCliente) return;
        try {
            const { error } = await supabase
                .from('Usuarios')
                .update({ CLIENTE_ID: selectedCliente.id })
                .eq('id', usuarioId);

            if (error) throw error;

            // Refresh details
            fetchDetails(selectedCliente.id);
            // Refresh unlinked list
            fetchUnlinkedUsers();
        } catch (err: any) {
            alert('Error al vincular usuario: ' + err.message);
        }
    };

    const handleOpenDetails = (cliente: Cliente) => {
        setSelectedCliente(cliente);
        setEditFormData(cliente);
        setIsEditing(false);
        setIsCreating(false);
        setIsRegisteringPayment(false);
        setShowHistory(false);
        setShowDocuments(false);
        setIsCreatingInvoice(false);
        setIsConfirmingDeleteClient(false);

        // Inicializar formulario de deuda
        setInvoiceFormData(prev => ({
            ...prev,
            desde_mes: cliente.Fecha_Ultimo_Pago ? format(startOfMonth(parseLocalDate(cliente.Fecha_Ultimo_Pago)), 'yyyy-MM-dd') : '',
            periodos: [],
            meses_detallados: [],
            meses: 0,
            monto: 0
        }));

        fetchDetails(cliente.id);
    };

    const handleOpenCreate = () => {
        setSelectedCliente({
            id: 0,
            Nombre_Completo: '',
            Telefono: '',
            Correo: '',
            Tarifa: 0,
            Plan: 'Mensualidad',
            Dia_De_Pago: 1,
            Cantidad_Vehiculo: 0,
            Requiere_Factura: false,
            Fecha_Ultimo_Pago: format(new Date(), 'yyyy-MM-dd')
        } as Cliente);
        setEditFormData({
            Nombre_Completo: '',
            Telefono: '',
            Correo: '',
            Tarifa: 0,
            Plan: 'Mensualidad',
            Dia_De_Pago: 1,
            Requiere_Factura: false,
            Fecha_Ultimo_Pago: format(new Date(), 'yyyy-MM-dd')
        });
        setIsEditing(false);
        setIsCreating(true);
        setIsRegisteringPayment(false);
        setShowHistory(false);
        setExtraData({ usuarios: [], vehiculos: [], cobros: [] });
    };

    const handleSaveCreate = async () => {
        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('CLIENTES')
                .insert([{
                    Nombre_Completo: editFormData.Nombre_Completo,
                    Telefono: editFormData.Telefono,
                    Correo: editFormData.Correo,
                    Tarifa: editFormData.Tarifa,
                    Plan: editFormData.Plan,
                    Dia_De_Pago: editFormData.Plan === 'Anualidad' ? null : editFormData.Dia_De_Pago,
                    Requiere_Factura: editFormData.Requiere_Factura,
                    Fecha_Ultimo_Pago: editFormData.Fecha_Ultimo_Pago,
                    Cantidad_Vehiculo: 0
                }])
                .select();

            if (error) throw error;

            await fetchClientes();
            setSelectedCliente(null);
            setIsCreating(false);
            alert('Cliente creado con éxito');
        } catch (err: any) {
            alert('Error al crear: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveInvoice = async () => {
        if (!selectedCliente || (invoiceFormData.meses_detallados.length === 0 && invoiceFormData.monto <= 0)) {
            alert('Por favor selecciona un periodo de deuda válido');
            return;
        }

        setIsSaving(true);
        try {
            // 1. GENERAR FACTURAS INDIVIDUALES POR MES
            if (invoiceFormData.meses_detallados.length > 0) {
                for (const item of invoiceFormData.meses_detallados) {
                    const nextNum = await getNextInvoiceNumber();

                    // Cálculo de ITBMS y Totales
                    const subtotal = item.monto;
                    const itbms = selectedCliente.Requiere_Factura ? Number((subtotal * 0.07).toFixed(2)) : 0;
                    const total = Number((subtotal + itbms).toFixed(2));

                    // Preparar items JSONB
                    const invoiceItems = [
                        {
                            descripcion: `Mensualidad de servicio de rastreo GPS ${item.label}`,
                            cantidad: item.equipos,
                            precio: selectedCliente.Tarifa || 0,
                            total: subtotal
                        }
                    ];

                    const { error: fError } = await supabase
                        .from('Facturas')
                        .insert([{
                            cliente_id: selectedCliente.id,
                            numero_factura: `${nextNum} (${item.label})`,
                            monto_subtotal: subtotal,
                            monto_itbms: itbms,
                            monto_total: total,
                            items: invoiceItems,
                            fecha_emision: invoiceFormData.fecha_emision,
                            fecha_vencimiento: invoiceFormData.fecha_vencimiento,
                            estado: 'pendiente',
                            es_electronica: invoiceFormData.es_electronica
                        }]);
                    if (fError) throw fError;
                }
            } else {
                const nextNum = await getNextInvoiceNumber();

                // Cálculo de ITBMS y Totales para factura manual/única
                const subtotal = invoiceFormData.monto;
                const itbms = selectedCliente.Requiere_Factura ? Number((subtotal * 0.07).toFixed(2)) : 0;
                const total = Number((subtotal + itbms).toFixed(2));

                const { error: fError } = await supabase
                    .from('Facturas')
                    .insert([{
                        cliente_id: selectedCliente.id,
                        numero_factura: invoiceFormData.numero || nextNum,
                        monto_subtotal: subtotal,
                        monto_itbms: itbms,
                        monto_total: total,
                        fecha_emision: invoiceFormData.fecha_emision,
                        fecha_vencimiento: invoiceFormData.fecha_vencimiento,
                        estado: 'pendiente'
                    }]);
                if (fError) throw fError;
            }

            // 2. ACTUALIZAR LA FECHA DE ÚLTIMO PAGO EN CLIENTE
            if (invoiceFormData.desde_mes) {
                // Asegurar formato YYYY-MM-DD
                const formattedDate = invoiceFormData.desde_mes.includes('-') && invoiceFormData.desde_mes.split('-').length === 2
                    ? `${invoiceFormData.desde_mes}-01`
                    : invoiceFormData.desde_mes;

                await supabase
                    .from('CLIENTES')
                    .update({ Fecha_Ultimo_Pago: formattedDate })
                    .eq('id', selectedCliente.id);
            }

            // Success
            setIsCreatingInvoice(false);
            setInvoiceFormData({
                numero: '',
                monto: 0,
                meses: 1,
                periodos: [],
                meses_detallados: [],
                desde_mes: format(new Date(), 'yyyy-MM'),
                fecha_emision: format(new Date(), 'yyyy-MM-dd'),
                fecha_vencimiento: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
                es_electronica: false
            });

            // Refresh details and client list
            fetchDetails(selectedCliente.id);
            fetchClientes();
        } catch (err: any) {
            console.error('Error saving invoice:', err.message);
            alert('Error al guardar: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        if (!selectedCliente) return;
        setIsSaving(true);
        try {
            // 1. Unlink payments (optional, depending on DB constraints, but safer manually)
            await supabase
                .from('Cobros')
                .update({ factura_id: null })
                .eq('factura_id', invoiceId);

            // 2. Delete the invoice
            const { error } = await supabase
                .from('Facturas')
                .delete()
                .eq('id', invoiceId);

            if (error) throw error;

            setConfirmingDeleteInvoiceId(null);
            fetchDetails(selectedCliente.id);
            fetchClientes();
            alert('Factura eliminada con éxito');
        } catch (err: any) {
            alert('Error al eliminar factura: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCotizacion = async (cotId: string) => {
        if (!selectedCliente) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('Cotizaciones')
                .delete()
                .eq('id', cotId);

            if (error) throw error;

            setConfirmingDeleteCotizacionId(null);
            fetchDetails(selectedCliente.id);
            alert('Cotización eliminada con éxito');
        } catch (err: any) {
            alert('Error al eliminar cotización: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCobro = async (cobroId: string, facturaId?: string) => {
        if (!selectedCliente) return;
        setIsSaving(true);
        try {
            // 1. Eliminar el cobro de la tabla
            const { error: dError } = await supabase
                .from('Cobros')
                .delete()
                .eq('id', cobroId);

            if (dError) throw dError;

            // 2. Si estaba vinculado a una factura, recalcular el estado de esa factura en la DB
            if (facturaId) {
                // Fetch remaining payments for this invoice
                const { data: remPagos } = await supabase.from('Cobros').select('monto_pagado').eq('factura_id', facturaId);
                const totalPagado = (remPagos || []).reduce((acc, p) => acc + p.monto_pagado, 0);

                // Fetch total de la factura
                const { data: inv } = await supabase.from('Facturas').select('monto_total').eq('id', facturaId).single();

                if (inv) {
                    const saldo = inv.monto_total - totalPagado;
                    const nuevoEstado = saldo <= 0 ? 'pagada' : (totalPagado > 0 ? 'abono' : 'pendiente');

                    await supabase
                        .from('Facturas')
                        .update({ estado: nuevoEstado })
                        .eq('id', facturaId);
                }
            }

            setConfirmingDeleteCobroId(null);
            fetchDetails(selectedCliente.id);
            fetchClientes(); // Update general balances
            alert('Pago eliminado con éxito');
        } catch (err: any) {
            alert('Error al eliminar el pago: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePayment = async () => {
        if (!selectedCliente) return;
        setIsSaving(true);
        try {
            let receiptUrl = null;

            // 1. Upload receipt if exists
            if (paymentFormData.recibo_file) {
                const file = paymentFormData.recibo_file;
                const fileExt = file.name.split('.').pop();
                const fileName = `${selectedCliente.id}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('recibos')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('recibos')
                    .getPublicUrl(filePath);

                receiptUrl = publicUrl;
            }

            // 2. Insert Payment
            const { error: pError } = await supabase
                .from('Cobros')
                .insert({
                    cliente_id: selectedCliente.id,
                    monto_pagado: paymentFormData.monto,
                    fecha_pago: paymentFormData.fecha,
                    periodo_cubierto: paymentFormData.periodo,
                    metodo_pago: paymentFormData.metodo,
                    factura_id: paymentFormData.factura_id || null,
                    archivo_recibo_url: receiptUrl
                });

            if (pError) throw pError;

            // 3. Update Invoice Status if linked
            if (paymentFormData.factura_id) {
                const invoice = pendingInvoices.find(f => f.id === paymentFormData.factura_id);
                if (invoice) {
                    const totalAnteriorPagado = (invoice.pagos_vincunlados || []).reduce((acc, p) => acc + p.monto_pagado, 0);
                    const nuevoTotalPagado = totalAnteriorPagado + paymentFormData.monto;
                    const nuevoSaldo = invoice.monto_total - nuevoTotalPagado;

                    let nuevoEstado: 'pagada' | 'abono' = nuevoSaldo <= 0 ? 'pagada' : 'abono';

                    await supabase
                        .from('Facturas')
                        .update({ estado: nuevoEstado })
                        .eq('id', paymentFormData.factura_id);

                    // 4. ACTUALIZAR FECHA DE ÚLTIMO PAGO SI LA FACTURA TIENE PERIODO Y ESTÁ PAGADA
                    if (nuevoEstado === 'pagada' && invoice.periodo) {
                        try {
                            // Extraer fecha del periodo (ej: "Febrero 2026")
                            const parts = invoice.periodo.split(' ');
                            if (parts.length === 2) {
                                const mesStr = parts[0].toLowerCase();
                                const anio = parseInt(parts[1]);
                                const meses: any = {
                                    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
                                    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
                                };
                                if (meses[mesStr] !== undefined) {
                                    const periodDate = new Date(anio, meses[mesStr], 1);

                                    // Solo actualizar si es posterior a la actual
                                    const currentLastPaid = selectedCliente.Fecha_Ultimo_Pago ? parseLocalDate(selectedCliente.Fecha_Ultimo_Pago) : new Date(0);
                                    if (isAfter(periodDate, currentLastPaid)) {
                                        await supabase
                                            .from('CLIENTES')
                                            .update({ Fecha_Ultimo_Pago: format(periodDate, 'yyyy-MM-dd') })
                                            .eq('id', selectedCliente.id);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error actualizando fecha de último pago:', e);
                        }
                    }
                }
            }

            // Reset form and refresh
            setIsRegisteringPayment(false);
            fetchDetails(selectedCliente.id);
            alert('Pago registrado con éxito' + (receiptUrl ? ' y recibo guardado' : ''));
        } catch (err: any) {
            alert('Error al registrar pago: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedCliente) return;
        setIsSaving(true);
        try {
            // 1. Update Cliente
            const { error: cError } = await supabase
                .from('CLIENTES')
                .update({
                    Nombre_Completo: editFormData.Nombre_Completo,
                    Telefono: editFormData.Telefono,
                    Correo: editFormData.Correo,
                    Tarifa: editFormData.Tarifa,
                    Plan: editFormData.Plan,
                    Dia_De_Pago: editFormData.Dia_De_Pago,
                    Requiere_Factura: editFormData.Requiere_Factura,
                    Fecha_Ultimo_Pago: editFormData.Fecha_Ultimo_Pago
                })
                .eq('id', selectedCliente.id);

            if (cError) throw cError;

            // map to store temporary ID -> real DB ID
            const userIdMap = new Map<number, number>();

            // 2. Update/Insert Usuarios
            for (const user of editUsuarios) {
                if (user.id > 0) {
                    const { error: uError } = await supabase
                        .from('Usuarios')
                        .update({ Usuario: user.Usuario })
                        .eq('id', user.id);
                    if (uError) throw uError;
                    userIdMap.set(user.id, user.id);
                } else {
                    const { data: newUser, error: uError } = await supabase
                        .from('Usuarios')
                        .insert({
                            Usuario: user.Usuario,
                            CLIENTE_ID: selectedCliente.id
                        })
                        .select()
                        .single();
                    if (uError) throw uError;
                    if (newUser) {
                        userIdMap.set(user.id, newUser.id);
                    }
                }
            }

            // 3. Update/Insert Vehículos
            for (const veh of editVehiculos) {
                const realUserId = userIdMap.get(veh.Usuario_ID) || veh.Usuario_ID;

                if (veh.id > 0) {
                    const { error: vError } = await supabase
                        .from('Vehiculos')
                        .update({
                            Placas: veh.Placas,
                            Fecha_Anualidad: veh.Fecha_Anualidad,
                            Usuario_ID: realUserId // Ensure it's correctly linked
                        })
                        .eq('id', veh.id);
                    if (vError) throw vError;
                } else {
                    if (realUserId > 0) {
                        const { error: vError } = await supabase
                            .from('Vehiculos')
                            .insert({
                                Placas: veh.Placas,
                                Fecha_Anualidad: veh.Fecha_Anualidad,
                                Usuario_ID: realUserId
                            });
                        if (vError) throw vError;
                    }
                }
            }

            // 4. Recalcular conteo total de equipos para el cliente (Salvaguarda)
            const { data: allUsers } = await supabase
                .from('Usuarios')
                .select('id')
                .eq('CLIENTE_ID', selectedCliente.id);

            const allUserIds = allUsers?.map(u => u.id) || [];
            let totalEquipos = 0;

            if (allUserIds.length > 0) {
                const { count } = await supabase
                    .from('Vehiculos')
                    .select('id', { count: 'exact', head: true })
                    .in('Usuario_ID', allUserIds);
                totalEquipos = count || 0;
            }

            await supabase
                .from('CLIENTES')
                .update({ Cantidad_Vehiculo: totalEquipos })
                .eq('id', selectedCliente.id);

            await fetchClientes();
            setSelectedCliente({ ...selectedCliente, ...editFormData, Cantidad_Vehiculo: totalEquipos } as Cliente);
            setExtraData({ usuarios: editUsuarios, vehiculos: editVehiculos, cobros: extraData.cobros });
            setIsEditing(false);
        } catch (err: any) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkUpToDate = async () => {
        if (!selectedCliente) return;
        if (!confirm('¿Estás seguro de que quieres marcar a este cliente como Al Día? Esto despejará todos los periodos pendientes de facturar hasta el mes actual.')) return;

        setIsSaving(true);
        try {
            // Establecer la fecha de hoy en formato local YYYY-MM-DD
            const todayStr = format(new Date(), 'yyyy-MM-dd');

            const { error } = await supabase
                .from('CLIENTES')
                .update({ Fecha_Ultimo_Pago: todayStr })
                .eq('id', selectedCliente.id);

            if (error) throw error;

            await fetchClientes();
            setSelectedCliente({ ...selectedCliente, Fecha_Ultimo_Pago: todayStr });
            alert('Cliente marcado como Al Día con éxito.');
        } catch (err: any) {
            alert('Error al actualizar: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCliente = async () => {
        if (!selectedCliente) return;
        if (!isConfirmingDeleteClient) {
            setIsConfirmingDeleteClient(true);
            setTimeout(() => setIsConfirmingDeleteClient(false), 3000);
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('CLIENTES')
                .delete()
                .eq('id', selectedCliente.id);

            if (error) throw error;

            await fetchClientes();
            setSelectedCliente(null);
            alert('Cliente eliminado con éxito');
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUsuario = async (id: number) => {
        if (confirmingDeleteUsuarioId !== id) {
            setConfirmingDeleteUsuarioId(id);
            setTimeout(() => setConfirmingDeleteUsuarioId(null), 3000);
            return;
        }

        try {
            // 1. Primero borrar los vehículos vinculados a este usuario
            // Esto evita el error de constraint de llave foránea
            const { error: vError } = await supabase
                .from('Vehiculos')
                .delete()
                .eq('Usuario_ID', id);

            if (vError) throw vError;

            // 2. Ahora sí borrar el usuario
            const { error } = await supabase
                .from('Usuarios')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setEditUsuarios(prev => prev.filter(u => u.id !== id));
            setEditVehiculos(prev => prev.filter(v => v.Usuario_ID !== id));
            // Actualizar vista detallada si no estamos editando
            if (!isEditing) fetchDetails(selectedCliente!.id);
        } catch (err: any) {
            alert('Error al eliminar usuario: ' + err.message);
        }
    };

    const handleDeleteVehiculo = async (id: number) => {
        if (confirmingDeleteVehiculoId !== id) {
            setConfirmingDeleteVehiculoId(id);
            setTimeout(() => setConfirmingDeleteVehiculoId(null), 3000);
            return;
        }

        try {
            const { error } = await supabase
                .from('Vehiculos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setEditVehiculos(prev => prev.filter(v => v.id !== id));
            // Actualizar vista detallada si no estamos editando
            if (!isEditing) fetchDetails(selectedCliente!.id);
        } catch (err: any) {
            alert('Error al eliminar vehículo: ' + err.message);
        }
    };

    const updateUsuarioItem = (id: number, value: string) => {
        setEditUsuarios(prev => prev.map(u => u.id === id ? { ...u, Usuario: value } : u));
    };

    const updateVehiculoItem = (id: number, field: keyof Vehiculo, value: any) => {
        setEditVehiculos(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const filteredClientes = clientes.filter(c =>
        c.Nombre_Completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Telefono?.includes(searchTerm) ||
        c.Correo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando clientes...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Clientes</h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">Gestiona tu cartera y el flujo de caja en un solo lugar.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, teléfono o correo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-card/40 border border-white/5 rounded-2xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary/40 focus:bg-card/60 outline-none transition-all placeholder:text-muted-foreground/40 text-white"
                        />
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl font-bold text-white/70 hover:bg-white/10 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                        <RefreshCw className={`${isSyncing ? 'animate-spin' : ''}`} size={18} />
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Finder'}
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="premium-gradient px-6 py-3 rounded-2xl font-bold shadow-xl shadow-blue-500/20 hover:scale-[1.03] active:scale-[0.97] transition-all whitespace-nowrap"
                    >
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            {error ? (
                <div className="glass p-12 rounded-3xl border-destructive/30 text-center max-w-2xl mx-auto shadow-2xl">
                    <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <X className="text-destructive" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold">Error de Conexión</h2>
                    <p className="mt-3 text-muted-foreground leading-relaxed">{error}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8 text-white">
                    {filteredClientes.map((cliente) => {
                        const isAnual = cliente.Plan && (cliente.Plan.toLowerCase().includes('anual') || cliente.Plan.toLowerCase().includes('anualidad'));

                        return (
                            <div key={cliente.id} className="glass p-8 rounded-3xl border border-white/5 hover:border-primary/40 transition-all duration-500 group relative overflow-hidden backdrop-blur-xl shadow-2xl cursor-default">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors duration-700" />

                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-600/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl border border-white/10">
                                            <User size={32} className="group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        </div>
                                        <div className="max-w-[180px] sm:max-w-none">
                                            <h3 className="text-2xl font-bold tracking-tight leading-tight truncate">{cliente.Nombre_Completo}</h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground/80">
                                                <span className="flex items-center gap-1.5"><Phone size={14} className="text-primary/60" /> {cliente.Telefono || 'S/N'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 text-right">
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isAnual ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}>
                                            {cliente.Plan || 'Mensual'}
                                        </span>
                                        {cliente.Fecha_Ultimo_Pago && (
                                            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                                Último Pago: {(() => {
                                                    const [y, m, d] = cliente.Fecha_Ultimo_Pago.split('-').map(Number);
                                                    return format(new Date(y, m - 1, d), 'dd/MM/yy');
                                                })()}
                                            </div>
                                        )}
                                        {cliente.Requiere_Factura && (
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-500/80 bg-yellow-500/5 px-2 py-1 rounded-lg border border-yellow-500/10 uppercase tracking-tighter">
                                                <Calculator size={10} /> Factura E.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Debt Indicator - Implementation */}
                                <div className="mt-6">
                                    {(() => {
                                        // Calculate months owed using the unified function
                                        const owedPeriods = detectOwedPeriods(cliente, []);
                                        const monthsOwed = owedPeriods.length;

                                        const statusLabel = (cliente.total_deuda || 0) === 0
                                            ? (monthsOwed === 0 ? 'AL DÍA' : `SIN FACTURAR (${monthsOwed})`)
                                            : monthsOwed === 1 ? 'DEBE 1 MES' : `DEBE ${monthsOwed} MESES`;

                                        const statusColor = (cliente.total_deuda || 0) === 0
                                            ? (monthsOwed === 0 ? 'text-green-500' : 'text-blue-400')
                                            : monthsOwed === 1 ? 'text-yellow-500' : 'text-red-500';

                                        const bgColor = (cliente.total_deuda || 0) === 0
                                            ? (monthsOwed === 0 ? 'bg-green-500/5' : 'bg-blue-500/5')
                                            : monthsOwed === 1 ? 'bg-yellow-500/5' : 'bg-red-500/5';

                                        const borderColor = (cliente.total_deuda || 0) === 0
                                            ? (monthsOwed === 0 ? 'border-green-500/10' : 'border-blue-500/10')
                                            : monthsOwed === 1 ? 'border-yellow-500/10' : 'border-red-500/10';

                                        return (
                                            <div className={`flex items-center justify-between p-4 rounded-2xl ${bgColor} border ${borderColor} transition-all`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusColor} bg-white/5`}>
                                                        {monthsOwed === 0 ? <ShieldCheck size={18} /> : <Clock size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Cartera</p>
                                                        <p className={`text-lg font-black ${statusColor}`}>
                                                            ${(cliente.total_deuda || 0).toLocaleString()}
                                                            <span className="text-[10px] text-muted-foreground ml-2 font-medium">SALDO</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estado</p>
                                                    <span className={`text-[10px] font-black uppercase ${statusColor} ${monthsOwed > 1 ? 'animate-pulse' : ''}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>


                                <div className="mt-10 grid grid-cols-3 gap-4">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors shadow-inner text-center sm:text-left">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Tarifa</p>
                                        <p className="text-xl font-black">${cliente.Tarifa}</p>
                                    </div>
                                    {isAnual ? (
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors shadow-inner text-center sm:text-left flex flex-col justify-center items-center sm:items-start">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Anexo</p>
                                            <Clock size={20} className="text-purple-400" />
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors shadow-inner text-center sm:text-left">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Día Pago</p>
                                            <p className="text-xl font-black">{String(cliente.Dia_De_Pago || 1).padStart(2, '0')}</p>
                                        </div>
                                    )}
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors shadow-inner text-center sm:text-left">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Equipos</p>
                                        <p className="text-xl font-black">{cliente.Cantidad_Vehiculo || 0}</p>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
                                    <p className="text-xs text-muted-foreground/60 font-medium truncate max-w-[140px] italic">
                                        {cliente.Correo || 'Sin correo electrónico'}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenDetails(cliente);
                                                setShowDocuments(true);
                                            }}
                                            className="flex items-center gap-2 text-[10px] font-black text-white/70 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                                        >
                                            <Receipt size={14} /> DEUDA
                                        </button>
                                        <button
                                            onClick={() => handleOpenDetails(cliente)}
                                            className="flex items-center gap-2 text-[10px] font-black text-primary px-4 py-2.5 rounded-xl bg-primary/5 hover:bg-primary/20 border border-primary/10 transition-all hover:translate-x-1"
                                        >
                                            DETALLES <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Detallado / Edición Integral */}
            {selectedCliente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end md:p-8 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={() => !isSaving && setSelectedCliente(null)} />
                    <div className="relative w-full h-full md:h-[95%] md:w-[600px] lg:w-[850px] bg-[#0f172a] md:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border-l border-white/10 overflow-hidden flex flex-col animate-in slide-in-from-right duration-500">

                        {/* Header Modal */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-card/10">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-[1.25rem] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                                    {isCreating ? <Plus size={32} /> : isEditing ? <Edit3 size={32} /> : <User size={32} />}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black leading-tight tracking-tight">
                                        {isCreating ? 'Nuevo Cliente' : isEditing ? 'Edición Integral' : selectedCliente.Nombre_Completo}
                                    </h2>
                                    <p className="text-sm text-muted-foreground/80 font-medium flex items-center gap-2">
                                        {isCreating ? 'Ingresa los datos para el nuevo registro' : isEditing ? 'Gestión total de cuenta y activos' : <><Phone size={14} /> {selectedCliente.Telefono}</>}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !isSaving && setSelectedCliente(null)}
                                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            >
                                <X size={24} className="text-muted-foreground" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar relative">

                            {isRegisteringPayment ? (
                                /* VISTA REGISTRO PAGO */
                                <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-8">
                                        <h3 className="text-2xl font-black text-white flex items-center gap-4">
                                            <CreditCard className="text-primary" size={28} /> Registrar Abono Manual
                                        </h3>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Vincular Factura (Opcional)</label>
                                            <select
                                                value={paymentFormData.factura_id || ''}
                                                onChange={(e) => {
                                                    const fid = e.target.value;
                                                    const invoice = pendingInvoices.find(f => f.id === fid);
                                                    setPaymentFormData({
                                                        ...paymentFormData,
                                                        factura_id: fid || null,
                                                        monto: invoice ? (invoice.saldo_pendiente || invoice.monto_total) : paymentFormData.monto
                                                    });
                                                }}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold appearance-none text-sm"
                                            >
                                                <option value="" className="bg-[#0f172a]">-- Ninguna (Pago General) --</option>
                                                {pendingInvoices.map(f => (
                                                    <option key={f.id} value={f.id} className="bg-[#0f172a]">
                                                        {f.numero_factura} - Saldo: ${f.saldo_pendiente?.toLocaleString() || f.monto_total.toLocaleString()}
                                                    </option>
                                                ))}
                                            </select>
                                            {paymentFormData.factura_id && (
                                                <div className="mt-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 p-3 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2">
                                                    Estas realizando un abono a la factura seleccionada.
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                                <Upload size={14} className="text-primary" /> Adjuntar Recibo / Comprobante
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    onChange={(e) => setPaymentFormData({ ...paymentFormData, recibo_file: e.target.files?.[0] || null })}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="w-full bg-white/5 border border-dashed border-white/10 group-hover:border-primary/40 rounded-2xl p-5 text-center transition-all">
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        {paymentFormData.recibo_file ? (
                                                            <span className="text-primary font-bold flex items-center justify-center gap-2 italic">
                                                                <FileText size={14} /> {paymentFormData.recibo_file.name}
                                                            </span>
                                                        ) : 'Haz clic o arrastra un archivo (PDF, JPG, PNG)'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Monto a Pagar ($)</label>
                                            <input
                                                type="number"
                                                value={paymentFormData.monto}
                                                onChange={(e) => setPaymentFormData({ ...paymentFormData, monto: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-3xl font-black text-white"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Método de Pago</label>
                                            <select
                                                value={paymentFormData.metodo}
                                                onChange={(e) => setPaymentFormData({ ...paymentFormData, metodo: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold appearance-none"
                                            >
                                                <option value="Efectivo" className="bg-[#0f172a]">Efectivo</option>
                                                <option value="Transferencia" className="bg-[#0f172a]">Transferencia</option>
                                                <option value="Tilo Pay (Manual)" className="bg-[#0f172a]">Tilo Pay (Manual)</option>
                                                <option value="Otro" className="bg-[#0f172a]">Otro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Periodo Cubierto</label>
                                            <input
                                                type="text"
                                                value={paymentFormData.periodo}
                                                onChange={(e) => setPaymentFormData({ ...paymentFormData, periodo: e.target.value })}
                                                placeholder="Ej: Febrero 2026"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fecha de Pago</label>
                                            <input
                                                type="date"
                                                value={paymentFormData.fecha}
                                                onChange={(e) => setPaymentFormData({ ...paymentFormData, fecha: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : showHistory ? (
                                /* VISTA HISTORIAL */
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-2xl font-black text-white flex items-center gap-4">
                                        <Clock className="text-primary" size={28} /> Historial de Cobros
                                    </h3>

                                    <div className="space-y-4">
                                        {extraData.cobros.length > 0 ? (
                                            extraData.cobros.map((cobro, idx) => (
                                                <div key={idx} className="p-6 rounded-3xl bg-white/5 border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 font-bold">
                                                            $
                                                        </div>
                                                        <div>
                                                            <p className="text-xl font-black text-white">${cobro.monto_pagado}</p>
                                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{cobro.periodo_cubierto}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6 text-right">
                                                        <div>
                                                            <p className="text-sm font-bold text-white mb-1">{formatDateLocal(cobro.fecha_pago)}</p>
                                                            <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                                                {cobro.metodo_pago}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            {confirmingDeleteCobroId === cobro.id ? (
                                                                <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300">
                                                                    <button
                                                                        onClick={() => handleDeleteCobro(cobro.id, cobro.factura_id)}
                                                                        disabled={isSaving}
                                                                        className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-all flex items-center gap-1"
                                                                    >
                                                                        {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                                                        Confirmar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setConfirmingDeleteCobroId(null)}
                                                                        className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setConfirmingDeleteCobroId(cobro.id)}
                                                                    className="p-2 bg-white/5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                                                                    title="Eliminar Pago"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                                                <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                                                    <Calculator size={32} />
                                                </div>
                                                <p className="text-muted-foreground font-medium italic">No hay registros de pagos para este cliente.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : isCreatingInvoice ? (
                                /* VISTA CREAR FACTURA */
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="text-2xl font-black text-white flex items-center gap-4">
                                        <Receipt size={28} className="text-primary" /> Registrar Deuda Pendiente
                                    </h3>

                                    <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Paso 1: Selección de Último Pago</p>
                                                <h4 className="text-xl font-black text-white">¿Cuál fue el último mes que pagó el cliente?</h4>
                                            </div>
                                            {invoiceFormData.periodos.length > 0 && (
                                                <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-2xl animate-pulse">
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Deuda Detectada</p>
                                                    <p className="text-sm font-bold text-white">{invoiceFormData.meses} {invoiceFormData.meses === 1 ? 'Mes' : 'Meses'} pendientes</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {(() => {
                                                const currentMonth = startOfMonth(new Date());
                                                // Últimos 12 meses
                                                const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(currentMonth, 11 - i)));

                                                return months.map((month, idx) => {
                                                    const label = format(month, 'MMMM yyyy', { locale: es });
                                                    const isoDate = format(month, 'yyyy-MM-dd');
                                                    const lastPaidDate = (invoiceFormData.desde_mes && invoiceFormData.desde_mes !== '')
                                                        ? (() => {
                                                            const [y, m, d] = invoiceFormData.desde_mes.split('-').map(Number);
                                                            return startOfMonth(new Date(y, m - 1, d));
                                                        })()
                                                        : null;

                                                    const isSelected = invoiceFormData.desde_mes === isoDate;
                                                    const isAfterLastPaid = lastPaidDate && isAfter(month, lastPaidDate);
                                                    const isPaid = lastPaidDate && !isAfter(month, lastPaidDate);

                                                    // Determinar estado visual
                                                    let statusClasses = "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10";
                                                    let icon = null;

                                                    if (isSelected) {
                                                        statusClasses = "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02] z-10";
                                                        icon = <ShieldCheck size={14} className="mb-1" />;
                                                    } else if (isPaid) {
                                                        statusClasses = "bg-green-500/10 border-green-500/20 text-green-500/50 opacity-60";
                                                        icon = <Check size={14} className="mb-1 opacity-40" />;
                                                    } else if (isAfterLastPaid) {
                                                        statusClasses = "bg-red-500/10 border-red-500/20 text-red-500 border-dashed animate-pulse";
                                                        icon = <Clock size={14} className="mb-1" />;
                                                    }

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const nextMonth = addMonths(month, 1);
                                                                const owedPeriods = detectOwedPeriods(selectedCliente!, [], nextMonth);

                                                                const count = owedPeriods.length;
                                                                const detailed = owedPeriods.map(p => ({
                                                                    ...p,
                                                                    equipos: selectedCliente?.Cantidad_Vehiculo || 0,
                                                                    monto: (selectedCliente?.Tarifa || 0) * (selectedCliente?.Cantidad_Vehiculo || 0)
                                                                }));

                                                                setInvoiceFormData(prev => ({
                                                                    ...prev,
                                                                    desde_mes: isoDate,
                                                                    periodos: owedPeriods,
                                                                    meses_detallados: detailed,
                                                                    meses: count,
                                                                    monto: detailed.reduce((sum, m) => sum + m.monto, 0)
                                                                }));
                                                            }}
                                                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 font-bold uppercase text-[10px] tracking-tighter text-center h-24 ${statusClasses}`}
                                                        >
                                                            {icon}
                                                            {label.split(' ')[0]}
                                                            <span className="opacity-60 block text-[8px] mt-0.5">{label.split(' ')[1]}</span>
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>

                                    {/* PASO 2: DESGLOSE POR MES */}
                                    {invoiceFormData.meses_detallados.length > 0 && (
                                        <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Paso 2: Detalle Mensual</p>
                                                    <h4 className="text-xl font-black text-white">Ajuste de Equipos por Mes</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Deuda</p>
                                                    <p className="text-3xl font-black text-white">${invoiceFormData.monto.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {invoiceFormData.meses_detallados.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                                                        <div className="flex-1">
                                                            <p className="text-xs font-black text-white uppercase tracking-widest">{item.label}</p>
                                                            <p className="text-[10px] text-muted-foreground font-bold italic">TARIFA: ${selectedCliente?.Tarifa} / unidad</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Equipos</p>
                                                                <input
                                                                    type="number"
                                                                    value={item.equipos}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        const newDetailed = [...invoiceFormData.meses_detallados];
                                                                        newDetailed[idx] = {
                                                                            ...item,
                                                                            equipos: val,
                                                                            monto: val * (selectedCliente?.Tarifa || 0)
                                                                        };
                                                                        setInvoiceFormData(prev => ({
                                                                            ...prev,
                                                                            meses_detallados: newDetailed,
                                                                            monto: newDetailed.reduce((sum, m) => sum + m.monto, 0)
                                                                        }));
                                                                    }}
                                                                    className="w-20 bg-white/10 border border-white/10 rounded-xl p-2 text-center text-white font-black text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                                                                />
                                                            </div>
                                                            <X size={12} className="text-muted-foreground mt-4" />
                                                            <div className="text-right min-w-[80px]">
                                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Subtotal</p>
                                                                <p className="text-sm font-black text-white">${item.monto.toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fecha Emisión</label>
                                            <input
                                                type="date"
                                                value={invoiceFormData.fecha_emision}
                                                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, fecha_emision: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Vencimiento</label>
                                            <input
                                                type="date"
                                                value={invoiceFormData.fecha_vencimiento}
                                                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, fecha_vencimiento: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary/40 text-white font-bold"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-4 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 cursor-pointer group hover:bg-blue-500/10 transition-all">
                                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${invoiceFormData.es_electronica ? 'bg-primary border-primary' : 'border-white/20'}`}>
                                            {invoiceFormData.es_electronica && <Check size={16} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={invoiceFormData.es_electronica}
                                            onChange={(e) => setInvoiceFormData({ ...invoiceFormData, es_electronica: e.target.checked })}
                                        />
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-widest">Factura Electrónica</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Marcar si esta factura requiere protocolo de la DGI</p>
                                        </div>
                                    </label>

                                    <button
                                        onClick={handleSaveInvoice}
                                        disabled={isSaving || invoiceFormData.meses_detallados.length === 0}
                                        className="w-full premium-gradient py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="animate-spin" size={24} />
                                        ) : invoiceFormData.meses_detallados.length === 0 ? (
                                            <ShieldCheck size={24} />
                                        ) : (
                                            <Save size={24} />
                                        )}
                                        {invoiceFormData.meses_detallados.length === 0 ? 'AL DÍA' : `GENERAR ${invoiceFormData.meses_detallados.length} FACTURAS INDIVIDUALES`}
                                    </button>
                                </div>
                            ) : isEditing || isCreating ? (
                                /* VISTA EDICIÓN INTEGRAL O CREACIÓN */
                                <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">

                                    {/* Datos Comerciales */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-3">
                                            <CreditCard size={18} /> Datos Comerciales
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.Nombre_Completo || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Nombre_Completo: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Teléfono</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.Telefono || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Telefono: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Electrónico</label>
                                                <input
                                                    type="email"
                                                    value={editFormData.Correo || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Correo: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Plan de Servicio</label>
                                                <select
                                                    value={editFormData.Plan || 'Mensualidad'}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Plan: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white appearance-none"
                                                >
                                                    <option value="Mensualidad" className="bg-[#0f172a]">Mensualidad</option>
                                                    <option value="Anualidad" className="bg-[#0f172a]">Anualidad</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tarifa ($)</label>
                                                <input
                                                    type="number"
                                                    value={editFormData.Tarifa || 0}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Tarifa: Number(e.target.value) })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white"
                                                />
                                            </div>
                                            {editFormData.Plan !== 'Anualidad' && (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Día de Pago (1, 15, 30)</label>
                                                    <select
                                                        value={editFormData.Dia_De_Pago || 1}
                                                        onChange={(e) => setEditFormData({ ...editFormData, Dia_De_Pago: Number(e.target.value) })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white appearance-none"
                                                    >
                                                        <option value="1" className="bg-[#0f172a]">Día 01</option>
                                                        <option value="15" className="bg-[#0f172a]">Día 15</option>
                                                        <option value="30" className="bg-[#0f172a]">Día 30</option>
                                                    </select>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fecha Último Pago</label>
                                                <input
                                                    type="date"
                                                    value={editFormData.Fecha_Ultimo_Pago || format(new Date(), 'yyyy-MM-dd')}
                                                    onChange={(e) => setEditFormData({ ...editFormData, Fecha_Ultimo_Pago: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-medium text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {!isCreating && (
                                        <>
                                            {/* Edición Usuarios */}
                                            <div className="space-y-6">
                                                <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-3">
                                                    <ShieldCheck size={18} /> Usuarios de Plataforma
                                                </h3>
                                                <div className="space-y-4">
                                                    {editUsuarios.map((u, idx) => (
                                                        <div key={u.id} className="flex items-center gap-4 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                                            <span className="text-[10px] font-black text-muted-foreground w-10">#{idx + 1}</span>
                                                            <input
                                                                type="text"
                                                                value={u.Usuario}
                                                                onChange={(e) => updateUsuarioItem(u.id, e.target.value)}
                                                                placeholder="Nombre de usuario..."
                                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/40 text-white font-black tracking-widest uppercase"
                                                            />
                                                            <button
                                                                onClick={() => addEmptyVehiculo(u.id)}
                                                                title="Agregar Vehículo a este usuario"
                                                                className="p-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all"
                                                            >
                                                                <Car size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUsuario(u.id)}
                                                                className={`p-3 rounded-xl transition-all flex items-center gap-2 ${confirmingDeleteUsuarioId === u.id
                                                                    ? 'bg-red-600 text-white animate-pulse'
                                                                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                                    }`}
                                                            >
                                                                <Trash2 size={18} />
                                                                {confirmingDeleteUsuarioId === u.id && <span className="text-[10px] font-black uppercase">¿Borrar?</span>}
                                                            </button>
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={addEmptyUsuario}
                                                        className="w-full p-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 text-muted-foreground hover:text-blue-400 transition-all flex items-center justify-center gap-3 group"
                                                    >
                                                        <Plus className="group-hover:rotate-90 transition-transform" />
                                                        <span className="text-xs font-black uppercase tracking-widest">Agregar Usuario Manual</span>
                                                    </button>

                                                    {/* Buscador de Usuarios Finder */}
                                                    <div className="mt-8 p-6 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 space-y-4">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                                                            <Plus size={14} /> Vincular Usuario de Finder AVL
                                                        </h4>
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                            <input
                                                                type="text"
                                                                placeholder="Buscar usuario en plataforma..."
                                                                value={userSearchTerm}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setUserSearchTerm(val);
                                                                    if (val.length > 2) fetchUnlinkedUsers(val);
                                                                }}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/40 outline-none"
                                                            />
                                                        </div>

                                                        {userSearchTerm.length > 2 && (
                                                            <div className="max-h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                                                {isSearchingUsers ? (
                                                                    <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-blue-400" size={20} /></div>
                                                                ) : allUnlinkedUsers.filter(u => u.Usuario.toLowerCase().includes(userSearchTerm.toLowerCase())).length > 0 ? (
                                                                    allUnlinkedUsers
                                                                        .filter(u => u.Usuario.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                                                        .slice(0, 10)
                                                                        .map(u => (
                                                                            <button
                                                                                key={u.id}
                                                                                onClick={() => {
                                                                                    linkUserToCliente(u.id);
                                                                                    setUserSearchTerm('');
                                                                                }}
                                                                                className="w-full text-left p-3 rounded-xl hover:bg-blue-500/20 flex justify-between items-center group transition-all"
                                                                            >
                                                                                <span className="font-bold text-sm tracking-wider uppercase">{u.Usuario}</span>
                                                                                <Plus className="text-blue-400 group-hover:scale-125 transition-transform" size={16} />
                                                                            </button>
                                                                        ))
                                                                ) : (
                                                                    <div className="text-center py-4 text-xs text-muted-foreground italic">No se encontraron usuarios disponibles.</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Edición Vehículos */}
                                            <div className="space-y-6">
                                                <h3 className="text-sm font-black uppercase tracking-widest text-green-400 flex items-center gap-3">
                                                    <Car size={18} /> Vehículos y GPS (Placas y Fechas)
                                                </h3>
                                                <div className="grid grid-cols-1 gap-4">
                                                    {editVehiculos.map((v, idx) => {
                                                        const user = editUsuarios.find(u => u.id === v.Usuario_ID);
                                                        return (
                                                            <div key={v.id} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6 items-end animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Placa</label>
                                                                    <input
                                                                        type="text"
                                                                        value={v.Placas}
                                                                        onChange={(e) => updateVehiculoItem(v.id, 'Placas', e.target.value)}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500/40 text-white font-black tracking-widest"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                                                                        {editFormData.Plan === 'Anualidad' ? 'Próx. Anualidad' : 'Fecha Referencia'}
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={v.Fecha_Anualidad || ''}
                                                                        onChange={(e) => updateVehiculoItem(v.id, 'Fecha_Anualidad', e.target.value)}
                                                                        placeholder="DD/MM/YYYY"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500/40 text-white font-bold"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="text-xs text-muted-foreground italic">
                                                                        Asignado a: <span className="text-primary font-bold">{user?.Usuario || 'N/A'}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleDeleteVehiculo(v.id)}
                                                                        className={`flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors p-2 rounded-lg ${confirmingDeleteVehiculoId === v.id
                                                                            ? 'bg-red-600 text-white animate-pulse'
                                                                            : 'text-red-400 hover:text-red-300'
                                                                            }`}
                                                                    >
                                                                        <Trash2 size={12} /> {confirmingDeleteVehiculoId === v.id ? '¿Confirmar?' : 'Eliminar Vehículo'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : showDocuments ? (
                                /* VISTA DOCUMENTOS */
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-2xl font-black text-white flex items-center gap-4">
                                            <FileText className="text-primary" size={28} /> Documentos y Facturación
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const nextNum = await getNextInvoiceNumber();
                                                    const periods = detectOwedPeriods(selectedCliente!, clientDocs.facturas);
                                                    const count = periods.length;
                                                    setInvoiceFormData({
                                                        ...invoiceFormData,
                                                        numero: nextNum,
                                                        meses: count,
                                                        periodos: periods,
                                                        desde_mes: periods.length > 0 ? format(periods[0].date, 'yyyy-MM') : format(new Date(), 'yyyy-MM'),
                                                        monto: (selectedCliente?.Tarifa || 0) * (selectedCliente?.Cantidad_Vehiculo || 0) * count
                                                    });
                                                    setIsCreatingInvoice(true);
                                                }}
                                                className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/80 transition-all flex items-center gap-2"
                                            >
                                                <Receipt size={14} /> Cargar Deuda
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-[10px] font-black uppercase tracking-widest bg-white/10 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
                                            >
                                                <Edit3 size={14} /> Editar Perfil
                                            </button>
                                            <a href="/cotizaciones" className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-xl hover:bg-primary/20 transition-all font-bold tracking-tight">
                                                NUEVA COTIZACIÓN
                                            </a>
                                        </div>
                                    </div>

                                    {/* Resumen Financiero */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Total en Facturas</p>
                                            <p className="text-2xl font-black text-white">
                                                ${clientDocs.facturas.reduce((acc, f) => acc + f.monto_total, 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 border border-white/5 p-6 rounded-3xl relative overflow-hidden">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Deuda Pendiente</p>
                                            <p className={`text-2xl font-black ${clientDocs.facturas.some(f => f.saldo_pendiente && f.saldo_pendiente > 0 && isAfter(addMonths(parseLocalDate(f.fecha_emision), 2), new Date()) === false) ? 'text-red-500' : 'text-yellow-500'}`}>
                                                ${clientDocs.facturas.reduce((acc, f) => acc + (f.saldo_pendiente || 0), 0).toLocaleString()}
                                            </p>
                                            {clientDocs.facturas.some(f => f.saldo_pendiente && f.saldo_pendiente > 0 && isAfter(addMonths(parseLocalDate(f.fecha_emision), 2), new Date()) === false) && (
                                                <div className="absolute top-2 right-4 px-2 py-0.5 bg-red-500 text-[8px] font-black text-white rounded uppercase animate-pulse">
                                                    Mora {"$>"} 60 Días
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lista de Facturas */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <Receipt size={14} /> Facturas Emitidas
                                        </h4>
                                        <div className="space-y-3">
                                            {clientDocs.facturas.length > 0 ? (
                                                clientDocs.facturas.map((fac, idx) => (
                                                    <div key={fac.id} className="p-5 rounded-3xl bg-white/5 border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fac.estado === 'pagada' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                                                <Receipt size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-sm">{fac.numero_factura}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase">{formatDateLocal(fac.fecha_emision, 'dd MMM yyyy')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="font-black text-sm">${fac.monto_total.toLocaleString()}</p>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${fac.estado === 'pagada' ? 'text-green-500 bg-green-500/5' : fac.estado === 'abono' ? 'text-blue-400 bg-blue-400/5' : 'text-yellow-500 bg-yellow-500/5'}`}>
                                                                        {fac.estado}
                                                                    </span>
                                                                    {(fac.saldo_pendiente !== undefined && fac.saldo_pendiente < fac.monto_total) && (
                                                                        <span className="text-[8px] font-bold text-muted-foreground italic">
                                                                            Saldo: ${fac.saldo_pendiente.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {fac.archivo_url && (
                                                                    <a href={fac.archivo_url} target="_blank" className="p-2 bg-white/5 rounded-xl text-primary hover:bg-primary hover:text-white transition-all">
                                                                        <ExternalLink size={16} />
                                                                    </a>
                                                                )}
                                                                {confirmingDeleteInvoiceId === fac.id ? (
                                                                    <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300">
                                                                        <button
                                                                            onClick={() => handleDeleteInvoice(fac.id)}
                                                                            disabled={isSaving}
                                                                            className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-all flex items-center gap-1"
                                                                        >
                                                                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmingDeleteInvoiceId(null)}
                                                                            className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmingDeleteInvoiceId(fac.id)}
                                                                        className="p-2 bg-white/5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                                                                        title="Eliminar Factura"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic text-center py-4">No hay facturas vinculadas.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lista de Cotizaciones */}
                                    <div className="space-y-4 pt-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                                            <FileText size={14} /> Cotizaciones Recientes
                                        </h4>
                                        <div className="space-y-3">
                                            {clientDocs.cotizaciones.length > 0 ? (
                                                clientDocs.cotizaciones.map((cot, idx) => (
                                                    <div key={cot.id} className="p-5 rounded-3xl bg-white/5 border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-sm">{cot.numero_cotizacion}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase">{formatDateLocal(cot.fecha_emision, 'dd MMM yyyy')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="font-black text-sm">${cot.monto_total.toLocaleString()}</p>
                                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded text-blue-400 bg-blue-400/5">
                                                                    {cot.estado}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {cot.archivo_url && (
                                                                    <a href={cot.archivo_url} target="_blank" className="p-2 bg-white/5 rounded-xl text-primary hover:bg-primary hover:text-white transition-all">
                                                                        <ExternalLink size={16} />
                                                                    </a>
                                                                )}
                                                                {confirmingDeleteCotizacionId === cot.id ? (
                                                                    <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300">
                                                                        <button
                                                                            onClick={() => handleDeleteCotizacion(cot.id)}
                                                                            disabled={isSaving}
                                                                            className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-all flex items-center gap-1"
                                                                        >
                                                                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setConfirmingDeleteCotizacionId(null)}
                                                                            className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmingDeleteCotizacionId(cot.id)}
                                                                        className="p-2 bg-white/5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                                                                        title="Eliminar Cotización"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic text-center py-4">No se han emitido cotizaciones.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* VISTA DETALLES (NORMAL) */
                                <>
                                    {/* Sección Usuarios */}
                                    <div className="space-y-6">
                                        <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                                            <ShieldCheck className="text-blue-400" size={24} /> Usuarios en Plataforma
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-white">
                                            {isLoadingDetails ? (
                                                [1, 2, 3].map(i => <div key={i} className="h-20 rounded-3xl bg-white/5 animate-pulse" />)
                                            ) : extraData.usuarios.length > 0 ? (
                                                extraData.usuarios.map(u => (
                                                    <div key={u.id} className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all flex items-center gap-5 shadow-lg group/u">
                                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/u:bg-blue-500 group-hover/u:text-white transition-all">
                                                            <User size={20} />
                                                        </div>
                                                        <p className="font-black text-lg tracking-[0.15em]">{u.Usuario}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic col-span-full p-6 bg-white/5 rounded-3xl border border-dashed border-white/10">No hay usuarios vinculados a este cliente.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sección Estado de Ciclos */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                                                <Clock className="text-primary" size={24} /> Estado de Ciclos de Pago
                                            </h3>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={handleMarkUpToDate}
                                                    className="text-xs font-bold text-green-500 hover:text-green-400 uppercase tracking-widest border border-green-500/20 px-3 py-1 rounded-lg bg-green-500/5 transition-all"
                                                >
                                                    Marcar como Al Día
                                                </button>
                                                <button
                                                    onClick={() => setShowDocuments(true)}
                                                    className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                                                >
                                                    Ver Facturas
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-8 rounded-[2rem] bg-gradient-to-br from-card to-[#161e2f] border border-white/5 shadow-2xl space-y-6 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors duration-700" />

                                            <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                                                <div className="space-y-4 flex-1">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2">Mensualidades Pendientes de Facturar</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {detectOwedPeriods(selectedCliente, clientDocs.facturas).length > 0 ? (
                                                                detectOwedPeriods(selectedCliente, clientDocs.facturas).map((p, i) => (
                                                                    <span key={i} className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-xl border border-primary/20 shadow-sm animate-in fade-in zoom-in duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                                                        {p.label}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs font-bold text-green-500 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">TODOS LOS CICLOS AL DÍA</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="md:border-l border-white/5 md:pl-8 space-y-4 min-w-[200px]">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Monto Estimado</p>
                                                        <p className="text-3xl font-black text-white">
                                                            ${(detectOwedPeriods(selectedCliente, clientDocs.facturas).length * (selectedCliente.Tarifa || 0) * (selectedCliente.Cantidad_Vehiculo || 0)).toLocaleString()}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground font-medium italic mt-1">Sugerencia basada en periodos faltantes</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {detectOwedPeriods(selectedCliente, clientDocs.facturas).length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        const nextNum = await getNextInvoiceNumber();
                                                        const periods = detectOwedPeriods(selectedCliente, clientDocs.facturas);
                                                        const count = periods.length;
                                                        setInvoiceFormData({
                                                            ...invoiceFormData,
                                                            numero: nextNum,
                                                            meses: count,
                                                            periodos: periods,
                                                            desde_mes: periods.length > 0 ? format(periods[0].date, 'yyyy-MM') : format(subMonths(new Date(), 1), 'yyyy-MM'),
                                                            monto: (selectedCliente?.Tarifa || 0) * (selectedCliente?.Cantidad_Vehiculo || 0) * count
                                                        });
                                                        setIsCreatingInvoice(true);
                                                    }}
                                                    className="w-full mt-4 bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                                >
                                                    <Receipt size={18} /> FACTURAR ESTOS PERIODOS
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sección Vehículos */}
                                    <div className="space-y-6">
                                        <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                                            <Car className="text-green-400" size={24} /> Vehículos y GPS Instalados
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {isLoadingDetails ? (
                                                [1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-[2rem] bg-white/5 animate-pulse" />)
                                            ) : extraData.vehiculos.length > 0 ? (
                                                extraData.vehiculos.map(v => {
                                                    const user = extraData.usuarios.find(u => u.id === v.Usuario_ID);
                                                    const isAnual = selectedCliente.Plan && (selectedCliente.Plan.toLowerCase().includes('anual') || selectedCliente.Plan.toLowerCase().includes('anualidad'));

                                                    // Dynamic payment date or anniversary
                                                    const displayDate = isAnual
                                                        ? (v.Fecha_Anualidad || 'PENDIENTE')
                                                        : getNextMonthlyPaymentDate(selectedCliente.Dia_De_Pago || 1);

                                                    return (
                                                        <div key={v.id} className="p-7 rounded-[2rem] bg-white/5 border border-white/5 hover:border-green-500/20 transition-all group/v shadow-xl relative overflow-hidden text-white">
                                                            <div className="flex justify-between items-center relative z-10">
                                                                <div className="flex items-center gap-6">
                                                                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center group-hover/v:scale-110 transition-transform shadow-inner">
                                                                        <Car size={32} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-3xl font-black tracking-widest">{v.Placas}</h4>
                                                                        <p className="text-[10px] uppercase font-black text-primary/60 mt-1 tracking-tighter">
                                                                            Usuario: <span className="text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{user?.Usuario || 'N/A'}</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] uppercase font-black text-muted-foreground/60 mb-2 flex items-center gap-1.5 justify-end">
                                                                        <Calendar size={12} className="text-green-500" /> Próx. {isAnual ? 'Anualidad' : 'Pago'}
                                                                    </p>
                                                                    <p className="text-lg font-black text-green-500 bg-green-500/5 px-4 py-1.5 rounded-xl border border-green-500/10 whitespace-nowrap">
                                                                        {displayDate}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic p-8 bg-white/5 rounded-[2rem] border border-dashed border-white/10 text-center col-span-full">Este cliente aún no tiene vehículos registrados.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-10 bg-[#161e2f]/50 backdrop-blur-3xl border-t border-white/10 flex gap-5">
                            {isRegisteringPayment ? (
                                <>
                                    <button
                                        onClick={() => setIsRegisteringPayment(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-2xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSavePayment}
                                        disabled={isSaving}
                                        className="flex-1 premium-gradient py-5 rounded-2xl font-black text-white shadow-2xl shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        Confirmar Pago
                                    </button>
                                </>
                            ) : isCreatingInvoice ? (
                                <>
                                    <button
                                        onClick={() => setIsCreatingInvoice(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-2xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveInvoice}
                                        disabled={isSaving || invoiceFormData.meses_detallados.length === 0}
                                        className="flex-1 premium-gradient py-5 rounded-2xl font-black text-white shadow-2xl shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : invoiceFormData.meses_detallados.length === 0 ? (
                                            <ShieldCheck size={20} />
                                        ) : (
                                            <Save size={20} />
                                        )}
                                        {invoiceFormData.meses_detallados.length === 0 ? 'AL DÍA' : `GENERAR ${invoiceFormData.meses_detallados.length} FACTURAS`}
                                    </button>
                                </>
                            ) : showHistory || showDocuments ? (
                                <button
                                    onClick={() => {
                                        setShowHistory(false);
                                        setShowDocuments(false);
                                    }}
                                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-3xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest"
                                >
                                    Volver a Detalles
                                </button>
                            ) : isCreating ? (
                                <>
                                    <button
                                        onClick={() => !isSaving && setSelectedCliente(null)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-2xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveCreate}
                                        disabled={isSaving}
                                        className="flex-1 premium-gradient py-5 rounded-2xl font-black text-white shadow-2xl shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        Crear Cliente
                                    </button>
                                </>
                            ) : isEditing ? (
                                <>
                                    <button
                                        onClick={handleDeleteCliente}
                                        className={`p-5 rounded-2xl transition-all flex items-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] ${isConfirmingDeleteClient
                                            ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/40'
                                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                            }`}
                                        title="Eliminar Cliente"
                                    >
                                        <Trash2 size={24} />
                                        {isConfirmingDeleteClient && "Confirmar Eliminar"}
                                    </button>
                                    <button
                                        onClick={() => !isSaving && setIsEditing(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-2xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving}
                                        className="flex-1 premium-gradient py-5 rounded-2xl font-black text-white shadow-2xl shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        Guardar Todo
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setPaymentFormData({
                                                ...paymentFormData,
                                                monto: selectedCliente.Tarifa,
                                                periodo: format(new Date(), 'MMMM yyyy', { locale: es }),
                                                fecha: format(new Date(), 'yyyy-MM-dd')
                                            });
                                            setIsRegisteringPayment(true);
                                        }}
                                        className="flex-1 premium-gradient py-5 rounded-3xl font-black text-white shadow-2xl shadow-blue-500/40 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                                    >
                                        <CreditCard size={20} /> Registrar Pago
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowHistory(false);
                                            setShowDocuments(!showDocuments);
                                        }}
                                        className={`bg-white/5 hover:bg-white/10 border border-white/10 px-8 rounded-3xl font-black active:scale-95 transition-all flex items-center justify-center group ${showDocuments ? 'bg-primary/20 text-primary border-primary/20' : 'text-white'}`}
                                        title="Documentación y Facturación"
                                    >
                                        <FileText size={24} className="group-hover:text-primary transition-colors" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDocuments(false);
                                            setShowHistory(!showHistory);
                                        }}
                                        className={`bg-white/5 hover:bg-white/10 border border-white/10 px-8 rounded-3xl font-black active:scale-95 transition-all flex items-center justify-center group ${showHistory ? 'bg-primary/20 text-primary border-primary/20' : 'text-white'}`}
                                        title="Historial de Pagos"
                                    >
                                        <Clock size={24} className="group-hover:text-primary transition-colors" />
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-3xl font-black text-white active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3 group"
                                    >
                                        <Edit3 size={20} className="group-hover:text-primary transition-colors" /> Editar Todo
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div >
            )
            }

            {/* Estilos scrollbar */}
            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.3);
        }
        input::placeholder {
          color: rgba(148, 163, 184, 0.4);
        }
        select option {
          background: #0f172a;
          color: white;
          padding: 10px;
        }
      `}</style>
        </div >
    );
}
