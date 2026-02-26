-- Tablas para el Módulo de Facturación y Cotizaciones

-- Secuencias para numeración automática
CREATE SEQUENCE IF NOT EXISTS numero_factura_seq START 1;
CREATE SEQUENCE IF NOT EXISTS numero_cotizacion_seq START 1;

-- 1. Tabla de Cotizaciones
CREATE TABLE IF NOT EXISTS public."Cotizaciones" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public."CLIENTES"(id),
    numero_cotizacion text UNIQUE DEFAULT ('COT-' || LPAD(nextval('numero_cotizacion_seq')::text, 4, '0')),
    nombre_prospecto text, -- Para cuando no es cliente aún
    items jsonb DEFAULT '[]'::jsonb, -- Array de {descripcion, cantidad, precio, itbms}
    monto_subtotal numeric(10,2) DEFAULT 0,
    monto_itbms numeric(10,2) DEFAULT 0,
    monto_total numeric(10,2) DEFAULT 0,
    fecha_emision date DEFAULT CURRENT_DATE,
    validez_dias integer DEFAULT 30,
    estado text DEFAULT 'borrador', -- borrador, enviada, aceptada, rechazada, facturada
    archivo_url text, -- Link al PDF en Storage
    created_at timestamptz DEFAULT now()
);

-- 2. Tabla de Facturas
CREATE TABLE IF NOT EXISTS public."Facturas" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint REFERENCES public."CLIENTES"(id) NOT NULL,
    cotizacion_id uuid REFERENCES public."Cotizaciones"(id),
    numero_factura text UNIQUE DEFAULT ('FAC-' || LPAD(nextval('numero_factura_seq')::text, 4, '0')),
    monto_subtotal numeric(10,2) DEFAULT 0,
    monto_itbms numeric(10,2) DEFAULT 0,
    monto_total numeric(10,2) DEFAULT 0,
    fecha_emision date DEFAULT CURRENT_DATE,
    fecha_vencimiento date,
    estado text DEFAULT 'pendiente', -- pendiente, pagada, anulada
    es_electronica boolean DEFAULT false,
    archivo_url text,
    created_at timestamptz DEFAULT now()
);

-- 3. Modificar Cobros para vincular con Facturas
ALTER TABLE public."Cobros" ADD COLUMN IF NOT EXISTS factura_id uuid REFERENCES public."Facturas"(id);
ALTER TABLE public."Cobros" ADD COLUMN IF NOT EXISTS archivo_recibo_url text;
