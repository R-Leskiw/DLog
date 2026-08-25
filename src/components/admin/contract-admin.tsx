"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ESTIMATE_DOCS_BUCKET } from "@/lib/estimates/constants";
import { createClient } from "@/lib/supabase/client";

export function ContractAdmin() {
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("company_settings")
      .select("contract_pdf_path")
      .eq("id", 1)
      .maybeSingle();
    if (loadError) {
      setError(
        loadError.message.includes("does not exist")
          ? "Run supabase/migrations/0007_estimate_proposals.sql in the SQL Editor."
          : loadError.message
      );
    } else {
      setPath(data?.contract_pdf_path ?? null);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Upload a PDF file.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const storagePath = `company/contract-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(ESTIMATE_DOCS_BUCKET)
      .upload(storagePath, file, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      setSaving(false);
      setError(uploadError.message);
      return;
    }
    const { error: upsertError } = await supabase.from("company_settings").upsert({
      id: 1,
      contract_pdf_path: storagePath,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setPath(storagePath);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading contract…</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {path
              ? "A company contract PDF is attached. It is appended after the estimate cover and line items."
              : "No contract uploaded yet. Estimates will send with cover, line items, and a signature block only."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="contract-pdf">Contract PDF</Label>
            <input
              id="contract-pdf"
              type="file"
              accept="application/pdf"
              disabled={saving}
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:text-sm"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          {saving ? (
            <p className="text-sm text-muted-foreground">Uploading…</p>
          ) : null}
          {path ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                const supabase = createClient();
                if (!supabase || !path) return;
                const { data, error: signedError } = await supabase.storage
                  .from(ESTIMATE_DOCS_BUCKET)
                  .createSignedUrl(path, 60);
                if (signedError || !data?.signedUrl) {
                  setError(signedError?.message ?? "Could not open PDF.");
                  return;
                }
                window.open(data.signedUrl, "_blank");
              }}
            >
              Preview current contract
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
