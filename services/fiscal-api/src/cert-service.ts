import forge from "node-forge";
import { supabaseAdmin, FISCAL_CERTS_BUCKET } from "./supabase.js";
import { normalizeCuit, storagePrefix, type FiscalEnvironment } from "./config.js";

export type CertPaths = {
  keyPath: string;
  csrPath: string;
  certPath: string;
};

export function getCertPaths(businessId: string, environment: FiscalEnvironment): CertPaths {
  const prefix = storagePrefix(businessId, environment);
  return {
    keyPath: `${prefix}/private.key`,
    csrPath: `${prefix}/request.csr`,
    certPath: `${prefix}/certificate.crt`,
  };
}

export async function generateCsrAndKey(params: {
  businessId: string;
  environment: FiscalEnvironment;
  cuit: string;
  razonSocial: string;
  uploadedBy?: string;
}) {
  const cuit = normalizeCuit(params.cuit);
  if (cuit.length !== 11) throw new Error("CUIT inválido (debe tener 11 dígitos)");

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: params.razonSocial.slice(0, 64) || "Empresa" },
    { name: "commonName", value: cuit },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());

  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const csrPem = forge.pki.certificationRequestToPem(csr);
  const paths = getCertPaths(params.businessId, params.environment);

  const keyBytes = Buffer.from(keyPem, "utf8");
  const csrBytes = Buffer.from(csrPem, "utf8");

  const { error: keyErr } = await supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).upload(paths.keyPath, keyBytes, {
    contentType: "text/plain",
    upsert: true,
  });
  if (keyErr) throw new Error(`Error guardando clave: ${keyErr.message}`);

  const { error: csrErr } = await supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).upload(paths.csrPath, csrBytes, {
    contentType: "application/pkcs10",
    upsert: true,
  });
  if (csrErr) throw new Error(`Error guardando CSR: ${csrErr.message}`);

  const { error: dbErr } = await supabaseAdmin.from("fiscal_certificates").upsert(
    {
      business_id: params.businessId,
      environment: params.environment,
      storage_path_key: paths.keyPath,
      storage_path_csr: paths.csrPath,
      storage_path_cert: null,
      cuit,
      status: "pending_upload",
      uploaded_by: params.uploadedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,environment" }
  );
  if (dbErr) throw new Error(`Error DB certificado: ${dbErr.message}`);

  return { csrPem, paths };
}

export async function downloadCsr(businessId: string, environment: FiscalEnvironment): Promise<string> {
  const paths = getCertPaths(businessId, environment);
  const { data, error } = await supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).download(paths.csrPath);
  if (error || !data) throw new Error("CSR no encontrado. Generá una solicitud primero.");
  return await data.text();
}

export async function uploadCertificate(params: {
  businessId: string;
  environment: FiscalEnvironment;
  certPem: string;
  uploadedBy?: string;
}) {
  const cuit = normalizeCuit(
    (
      await supabaseAdmin
        .from("fiscal_certificates")
        .select("cuit")
        .eq("business_id", params.businessId)
        .eq("environment", params.environment)
        .maybeSingle()
    ).data?.cuit ?? ""
  );

  const cert = forge.pki.certificateFromPem(params.certPem);
  const paths = getCertPaths(params.businessId, params.environment);

  const { data: keyBlob, error: keyErr } = await supabaseAdmin.storage
    .from(FISCAL_CERTS_BUCKET)
    .download(paths.keyPath);
  if (keyErr || !keyBlob) throw new Error("Clave privada no encontrada");

  const keyPem = await keyBlob.text();
  const privateKey = forge.pki.privateKeyFromPem(keyPem);
  const certPublicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const test = forge.pki.rsa.encrypt("test", certPublicKey);
  forge.pki.rsa.decrypt(test, privateKey);

  const certBytes = Buffer.from(params.certPem, "utf8");
  const { error: uploadErr } = await supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).upload(paths.certPath, certBytes, {
    contentType: "application/x-x509-ca-cert",
    upsert: true,
  });
  if (uploadErr) throw new Error(`Error subiendo certificado: ${uploadErr.message}`);

  const notAfter = cert.validity.notAfter;
  const notBefore = cert.validity.notBefore;

  const { error: dbErr } = await supabaseAdmin
    .from("fiscal_certificates")
    .update({
      storage_path_cert: paths.certPath,
      status: "active",
      issued_at: notBefore.toISOString(),
      expires_at: notAfter.toISOString(),
      uploaded_by: params.uploadedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", params.businessId)
    .eq("environment", params.environment);
  if (dbErr) throw new Error(`Error actualizando certificado: ${dbErr.message}`);

  return { cuit, expiresAt: notAfter.toISOString() };
}

export async function loadCertAndKey(businessId: string, environment: FiscalEnvironment) {
  const { data: meta, error } = await supabaseAdmin
    .from("fiscal_certificates")
    .select("*")
    .eq("business_id", businessId)
    .eq("environment", environment)
    .eq("status", "active")
    .maybeSingle();
  if (error || !meta) throw new Error("Certificado activo no encontrado para este ambiente");

  const [certRes, keyRes] = await Promise.all([
    supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).download(meta.storage_path_cert!),
    supabaseAdmin.storage.from(FISCAL_CERTS_BUCKET).download(meta.storage_path_key),
  ]);
  if (certRes.error || !certRes.data) throw new Error("No se pudo leer el certificado");
  if (keyRes.error || !keyRes.data) throw new Error("No se pudo leer la clave privada");

  return {
    cert: await certRes.data.text(),
    key: await keyRes.data.text(),
    cuit: meta.cuit as string,
    expiresAt: meta.expires_at as string | null,
  };
}
