-- Script para crear la tabla de Cobros en Supabase
-- Ejecuta esto en el "SQL Editor" de tu panel de Supabase

CREATE TABLE IF NOT EXISTS public."Cobros" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id bigint NOT NULL REFERENCES public."CLIENTES"(id) ON DELETE CASCADE,
    monto_pagado numeric NOT NULL,
    fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
    periodo_cubierto text,
    metodo_pago text,
    created_at timestamptz DEFAULT now()
);

-- Habilitar RLS (Opcional, pero recomendado)
ALTER TABLE public."Cobros" ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla Cobros
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public."Cobros";
CREATE POLICY "Permitir todo a usuarios autenticados" ON public."Cobros" FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo de forma pública" ON public."Cobros";
CREATE POLICY "Permitir todo de forma pública" ON public."Cobros" FOR ALL TO public USING (true) WITH CHECK (true);

-- Script para habilitar RLS en CLIENTES (si no está ya habilitado)
ALTER TABLE public."CLIENTES" ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla CLIENTES
-- Asegúrate de que estas políticas existan para permitir la creación y edición
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public."CLIENTES";
CREATE POLICY "Permitir todo a usuarios autenticados" ON public."CLIENTES" FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo de forma pública" ON public."CLIENTES";
CREATE POLICY "Permitir todo de forma pública" ON public."CLIENTES" FOR ALL TO public USING (true) WITH CHECK (true);

-- ACTUALIZACIONES PARA INTEGRACIÓN FINDER AVL
-- Añadir columna para ID de Finder en Usuarios si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Usuarios' AND column_name='finder_id') THEN
        ALTER TABLE public."Usuarios" ADD COLUMN finder_id text UNIQUE;
    END IF;
END $$;

-- Asegurar que CLIENTE_ID sea opcional para permitir pre-sincronización
ALTER TABLE public."Usuarios" ALTER COLUMN "CLIENTE_ID" DROP NOT NULL;

-- Añadir columna para ID de Finder en Vehiculos si no existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vehiculos' AND column_name='finder_id') THEN
        ALTER TABLE public."Vehiculos" ADD COLUMN finder_id text UNIQUE;
    END IF;
END $$;

-- Habilitar RLS y políticas para Usuarios y Vehiculos
ALTER TABLE public."Usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo de forma pública" ON public."Usuarios";
CREATE POLICY "Permitir todo de forma pública" ON public."Usuarios" FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public."Vehiculos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo de forma pública" ON public."Vehiculos";
CREATE POLICY "Permitir todo de forma pública" ON public."Vehiculos" FOR ALL TO public USING (true) WITH CHECK (true);
