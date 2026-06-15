import express from "express";
import cors from "cors";
import { z } from "zod";
import { assertConfig } from "./config.js";
import { requireApiKey } from "./middleware/auth.js";
import { generateCsrAndKey, downloadCsr, uploadCertificate } from "./cert-service.js";
import {
  testConnection,
  getLastVoucherNumber,
  issueFacturaC,
  issueCreditNoteC,
} from "./afip-service.js";
import { supabaseAdmin } from "./supabase.js";

assertConfig();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const baseSchema = z.object({
  businessId: z.string().uuid(),
  environment: z.enum(["homolog", "prod"]),
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fiscal-api" });
});

app.use(requireApiKey);

app.post("/cert/generate", async (req, res) => {
  try {
    const body = baseSchema.extend({
      cuit: z.string().min(11),
      razonSocial: z.string().min(1),
      uploadedBy: z.string().uuid().optional(),
    }).parse(req.body);

    const result = await generateCsrAndKey(body);
    res.json({ ok: true, csrPem: result.csrPem });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.get("/cert/download-csr", async (req, res) => {
  try {
    const businessId = String(req.query.businessId ?? "");
    const environment = String(req.query.environment ?? "homolog") as "homolog" | "prod";
    if (!businessId) throw new Error("businessId requerido");
    const csr = await downloadCsr(businessId, environment);
    res.setHeader("Content-Type", "application/pkcs10");
    res.setHeader("Content-Disposition", 'attachment; filename="request.csr"');
    res.send(csr);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.post("/cert/upload", async (req, res) => {
  try {
    const body = baseSchema.extend({
      certPem: z.string().min(100),
      uploadedBy: z.string().uuid().optional(),
    }).parse(req.body);
    const result = await uploadCertificate(body);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.post("/auth/test", async (req, res) => {
  try {
    const body = baseSchema.parse(req.body);
    const result = await testConnection(body.businessId, body.environment);
    await supabaseAdmin
      .from("business_fiscal_config")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("business_id", body.businessId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.get("/voucher/last-number", async (req, res) => {
  try {
    const businessId = String(req.query.businessId ?? "");
    const environment = String(req.query.environment ?? "homolog") as "homolog" | "prod";
    const voucherType = Number(req.query.voucherType ?? 11);
    if (!businessId) throw new Error("businessId requerido");
    const result = await getLastVoucherNumber(businessId, environment, voucherType);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.post("/voucher/issue", async (req, res) => {
  try {
    const body = baseSchema.extend({
      saleId: z.string().uuid().nullable().optional(),
      items: z.array(
        z.object({
          name: z.string(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative(),
        })
      ).min(1),
      buyerDocType: z.number().optional(),
      buyerDocNumber: z.string().optional(),
      buyerName: z.string().optional(),
      concept: z.number().optional(),
    }).parse(req.body);
    const result = await issueFacturaC(body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.post("/voucher/credit-note", async (req, res) => {
  try {
    const body = baseSchema.extend({
      originalVoucherId: z.string().uuid(),
    }).parse(req.body);
    const result = await issueCreditNoteC(body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

// Fase 2: consolidated billing stub
app.post("/voucher/consolidated", async (_req, res) => {
  res.status(501).json({ error: "Facturación consolidada disponible en Fase 2" });
});

const port = Number(process.env.PORT ?? 3099);
app.listen(port, () => {
  console.log(`fiscal-api listening on :${port}`);
});

export default app;
