
-- Función para recalcular el conteo de vehículos de un cliente
CREATE OR REPLACE FUNCTION public.fn_update_cliente_vehiculo_count()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id bigint;
BEGIN
    -- Determinar el CLIENTE_ID afectado
    IF TG_OP = 'DELETE' THEN
        -- Si borramos un vehículo, necesitamos el CLIENTE_ID a través del Usuario antiguo
        SELECT "CLIENTE_ID" INTO v_cliente_id FROM public."Usuarios" WHERE id = OLD."Usuario_ID";
    ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Si insertamos/actualizamos, usamos el Usuario nuevo
        SELECT "CLIENTE_ID" INTO v_cliente_id FROM public."Usuarios" WHERE id = NEW."Usuario_ID";
    END IF;

    -- Si tenemos un cliente vinculado, actualizamos su contador
    IF v_cliente_id IS NOT NULL THEN
        UPDATE public."CLIENTES"
        SET "Cantidad_Vehiculo" = (
            SELECT COUNT(*)
            FROM public."Vehiculos" v
            JOIN public."Usuarios" u ON v."Usuario_ID" = u.id
            WHERE u."CLIENTE_ID" = v_cliente_id
        )
        WHERE id = v_cliente_id;
    END IF;

    -- Si es un UPDATE y cambió el Usuario_ID, también actualizar el anterior
    IF TG_OP = 'UPDATE' AND OLD."Usuario_ID" IS DISTINCT FROM NEW."Usuario_ID" THEN
        SELECT "CLIENTE_ID" INTO v_cliente_id FROM public."Usuarios" WHERE id = OLD."Usuario_ID";
        IF v_cliente_id IS NOT NULL THEN
            UPDATE public."CLIENTES"
            SET "Cantidad_Vehiculo" = (
                SELECT COUNT(*)
                FROM public."Vehiculos" v
                JOIN public."Usuarios" u ON v."Usuario_ID" = u.id
                WHERE u."CLIENTE_ID" = v_cliente_id
            )
            WHERE id = v_cliente_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger sobre la tabla Vehiculos
DROP TRIGGER IF EXISTS tr_update_vehiculo_count ON public."Vehiculos";
CREATE TRIGGER tr_update_vehiculo_count
AFTER INSERT OR UPDATE OR DELETE ON public."Vehiculos"
FOR EACH ROW EXECUTE FUNCTION public.fn_update_cliente_vehiculo_count();

-- Función adicional para cuando se vincula/desvincula un Usuario a un Cliente
CREATE OR REPLACE FUNCTION public.fn_update_cliente_user_link_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el cliente nuevo
    IF NEW."CLIENTE_ID" IS NOT NULL THEN
        UPDATE public."CLIENTES"
        SET "Cantidad_Vehiculo" = (
            SELECT COUNT(*)
            FROM public."Vehiculos" v
            JOIN public."Usuarios" u ON v."Usuario_ID" = u.id
            WHERE u."CLIENTE_ID" = NEW."CLIENTE_ID"
        )
        WHERE id = NEW."CLIENTE_ID";
    END IF;

    -- Actualizar el cliente viejo si existía
    IF OLD."CLIENTE_ID" IS NOT NULL AND OLD."CLIENTE_ID" IS DISTINCT FROM NEW."CLIENTE_ID" THEN
        UPDATE public."CLIENTES"
        SET "Cantidad_Vehiculo" = (
            SELECT COUNT(*)
            FROM public."Vehiculos" v
            JOIN public."Usuarios" u ON v."Usuario_ID" = u.id
            WHERE u."CLIENTE_ID" = OLD."CLIENTE_ID"
        )
        WHERE id = OLD."CLIENTE_ID";
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger sobre la tabla Usuarios
DROP TRIGGER IF EXISTS tr_update_user_link_count ON public."Usuarios";
CREATE TRIGGER tr_update_user_link_count
AFTER UPDATE OF "CLIENTE_ID" ON public."Usuarios"
FOR EACH ROW EXECUTE FUNCTION public.fn_update_cliente_user_link_count();
