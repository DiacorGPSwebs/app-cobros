
const API_BASE_URL = 'https://rastreo.diacorserver.com/v3/apis/global_api/v3.1.0/public/index.php';

interface AuthResponse {
    success: boolean;
    data: {
        token: string;
        expiration: string;
        expiration_ts: number;
    };
}

export interface FinderUser {
    id_usuario: string;
    usuario: string;
    nombre: string;
    email: string;
    cantidad_vehiculos: string;
}

export interface FinderDevice {
    id_dispositivo: string;
    id_usuario: string;
    placa: string;
    nombre: string;
    imei: string;
    marca: string;
    modelo: string;
}

class FinderAPI {
    private token: string | null = null;
    private expirationTs: number = 0;

    private async login() {
        // En producción, estos vendrían de process.env
        const user = process.env.NEXT_PUBLIC_FINDER_USER;
        const password = process.env.NEXT_PUBLIC_FINDER_PASSWORD;

        if (!user || !password) {
            throw new Error('Credenciales de Finder AVL no configuradas');
        }

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, password }),
        });

        const result: AuthResponse = await response.json();
        if (result.success) {
            this.token = result.data.token;
            this.expirationTs = result.data.expiration_ts;
        } else {
            throw new Error('Fallo en la autenticación con Finder AVL');
        }
    }

    private async ensureToken() {
        const now = Math.floor(Date.now() / 1000);
        if (!this.token || now >= this.expirationTs - 60) {
            await this.login();
        }
    }

    async getUsuarios(): Promise<FinderUser[]> {
        await this.ensureToken();
        const response = await fetch(`${API_BASE_URL}/usuarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        });
        const result = await response.json();
        return result.success ? result.data : [];
    }

    async getDispositivos(): Promise<FinderDevice[]> {
        await this.ensureToken();
        const response = await fetch(`${API_BASE_URL}/dispositivos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        });
        const result = await response.json();
        return result.success ? result.data : [];
    }
}

export const finderApi = new FinderAPI();
