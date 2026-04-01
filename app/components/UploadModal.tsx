"use client";

import { useState, useCallback } from "react";

const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Free)" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano VL (Free)" },
];

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [designer, setDesigner] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [model, setModel] = useState(AVAILABLE_MODELS[0].id);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      setProgress(`Classifying ${i + 1}/${files.length}: ${files[i].name}...`);
      const form = new FormData();
      form.append("file", files[i]);
      form.append("designer", designer || "Unknown");
      form.append("model", model);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json();
          console.error("Upload failed:", err);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    setUploading(false);
    setFiles([]);
    setProgress("");
    onUploaded();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Upload Garment Photos</h2>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-gray-600 mb-2">Drag & drop images here, or</p>
          <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            Browse Files
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">{files.length} file(s) selected</p>
            <div className="max-h-24 overflow-y-auto text-sm text-gray-500">
              {files.map((f, i) => <div key={i}>{f.name}</div>)}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Designer Name</label>
          <input
            type="text"
            value={designer}
            onChange={e => setDesigner(e.target.value)}
            placeholder="e.g. Jane Smith"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {uploading && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm text-blue-800">{progress}</span>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            disabled={uploading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <p><span className="font-medium text-gray-600">Best accuracy:</span> Claude Sonnet 4 or GPT-4o — top-tier for detailed visual analysis</p>
            <p><span className="font-medium text-gray-600">Fastest/cheapest:</span> Claude Haiku 4.5 or GPT-4o Mini — solid at a fraction of the cost</p>
            <p><span className="font-medium text-gray-600">Best value:</span> Gemini 2.5 Flash — competitive quality, completely free (500 req/day)</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Default: Gemini 2.5 Flash (free via Google API). Other models via OpenRouter (requires credits).</p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800" disabled={uploading}>
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload & Classify
          </button>
        </div>
      </div>
    </div>
  );
}
