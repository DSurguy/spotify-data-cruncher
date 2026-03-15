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
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, path: path.trim() }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(msg);
        return;
      }
      const body = await res.json();
      const inserted: number = body.import.inserted_records;
      onDone();
      // Brief feedback before closing
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
          Point to the folder containing your <code>Streaming_History_*.json</code> files.
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
            <Label htmlFor="import-path">Path to folder</Label>
            <Input
              id="import-path"
              placeholder="/home/you/spotify-export/unzipped"
              value={path}
              onChange={e => setPath(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || !path.trim()}>
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
