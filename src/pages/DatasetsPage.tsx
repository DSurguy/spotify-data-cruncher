import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Dataset, GetDatasetsResponse } from "@/types/api";

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  async function loadDatasets() {
    const res = await fetch("/api/datasets");
    const body: GetDatasetsResponse = await res.json();
    setDatasets(body.datasets);
    setLoading(false);
  }

  useEffect(() => { loadDatasets(); }, []);

  function handleImportDone() {
    setShowImport(false);
    loadDatasets();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Datasets</h2>
        <Button onClick={() => setShowImport(v => !v)}>
          {showImport ? "Cancel" : "Import Data"}
        </Button>
      </div>

      {showImport && <ImportForm onDone={handleImportDone} />}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No datasets yet.</p>
          <p className="text-sm">Click <strong>Import Data</strong> to load your Spotify history.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {datasets.map(ds => <DatasetCard key={ds.id} dataset={ds} onDeleted={loadDatasets} />)}
        </div>
      )}
    </div>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      if (name.trim()) formData.set("name", name.trim());
      formData.set("file", file);
      const res = await fetch("/api/datasets", { method: "POST", body: formData });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const body = await res.json();
      const inserted: number = body.import.inserted_records;
      onDone();
      alert(`Import complete: ${inserted.toLocaleString()} records imported.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Import Spotify Data</CardTitle>
        <CardDescription>
          Upload the ZIP file from your Spotify data export.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-name">Dataset name (optional)</Label>
            <Input
              id="import-name"
              placeholder={`Import ${new Date().toLocaleDateString()}`}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-file">Spotify export ZIP</Label>
            <input
              id="import-file"
              type="file"
              accept=".zip"
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DatasetCard({ dataset, onDeleted }: { dataset: Dataset; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await fetch(`/api/datasets/${dataset.id}`, { method: "DELETE" });
    onDeleted();
  }

  const date = new Date(dataset.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="font-medium">{dataset.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Imported {date}</p>
          {dataset.source_path && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{dataset.source_path}</p>
          )}
        </div>
        <div className="flex gap-2">
          {confirming ? (
            <>
              <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Delete</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
