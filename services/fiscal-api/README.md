# Fiscal API (ARCA / AFIP)

Microservicio para certificados, WSAA y emisión de comprobantes electrónicos.

## Variables de entorno

```env
PORT=3099
FISCAL_API_KEY=your-secret-key
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
AFIP_SDK_ACCESS_TOKEN=
```

`AFIP_SDK_ACCESS_TOKEN` es opcional según tu cuenta en AfipSDK; debe coincidir con `FISCAL_API_KEY` en la app Next.js.

## Deploy en Seenode (servicio aparte)

`fiscal-api` **no va dentro del build de Next.js**. Creá un **segundo Web Service** en Seenode:

| Campo | Valor |
|--------|--------|
| Root directory | `services/fiscal-api` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Port | `3099` (o el que uses en `PORT`) |

En el Web Service de **Next.js**, configurá:

```env
FISCAL_API_URL=https://tu-fiscal-api.seenode.com
FISCAL_API_KEY=misma-clave-que-en-fiscal-api
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
