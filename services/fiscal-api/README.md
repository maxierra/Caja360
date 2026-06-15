# Fiscal API (ARCA / AFIP)

Microservicio para certificados, WSAA y emisión de comprobantes electrónicos.

## Variables de entorno

```env
PORT=3099
FISCAL_API_KEY=your-secret-key
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Desarrollo

```bash
cd services/fiscal-api
npm install
npm run dev
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /cert/generate | Genera CSR + clave privada |
| POST | /cert/upload | Sube certificado .crt de ARCA |
| GET | /cert/download-csr | Descarga CSR |
| POST | /auth/test | Prueba WSAA + último comprobante |
| GET | /voucher/last-number | FECompUltimoAutorizado |
| POST | /voucher/issue | Emite Factura C |
| POST | /voucher/credit-note | Emite NC C |

Header requerido: `Authorization: Bearer {FISCAL_API_KEY}`

Body común: `{ "businessId": "uuid", "environment": "homolog" | "prod" }`
