"use client";

import { useState, useEffect } from "react";
import { ImageRecord, Annotation } from "@/lib/types";

interface ImageDetailProps {
  image: ImageRecord;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ImageDetail({ image, onClose, onDeleted }: ImageDetailProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newTags, setNewTags] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this image? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: "DELETE" });
      if (res.ok) {
        onClose();
        onDeleted?.();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
    setDeleting(false);
  };

  useEffect(() => {
    fetch(`/api/annotations?image_id=${image.id}`)
      .then(r => r.json())
      .then(setAnnotations)
      .catch(console.error);
  }, [image.id]);

  const handleAddAnnotation = async () => {
    if (!newTags && !newNotes) return;
    setSaving(true);
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: image.id,
          tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
          notes: newNotes,
        }),
      });
      if (res.ok) {
        const annotation = await res.json();
        setAnnotations(prev => [annotation, ...prev]);
        setNewTags("");
        setNewNotes("");
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const attrs = image.attributes;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/2 bg-gray-100">
            <img
              src={`/uploads/${image.filename}`}
              alt={image.original_name}
              className="w-full h-auto object-contain max-h-[500px]"
            />
          </div>
          <div className="md:w-1/2 p-6 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{attrs.garment_type}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-400 hover:text-red-600 text-sm disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">{image.description}</p>

            <div className="space-y-2 mb-4">
              <AttrRow label="Style" value={attrs.style} />
              <AttrRow label="Material" value={attrs.material} />
              <AttrRow label="Colors" value={attrs.color_palette.join(", ")} />
              <AttrRow label="Pattern" value={attrs.pattern} />
              <AttrRow label="Season" value={attrs.season} />
              <AttrRow label="Occasion" value={attrs.occasion} />
              <AttrRow label="Consumer" value={attrs.consumer_profile} />
              <AttrRow label="Trend" value={attrs.trend_notes} />
              <AttrRow label="Location" value={[attrs.location_city, attrs.location_country, attrs.location_continent].filter(v => v && v !== "unknown").join(", ") || "Unknown"} />
              <AttrRow label="Designer" value={image.designer} />
              <AttrRow label="Uploaded" value={new Date(image.upload_date).toLocaleDateString()} />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Designer Annotations</h3>

              {annotations.map(a => (
                <div key={a.id} className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {a.tags.map((t, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-yellow-200 rounded-full text-yellow-800">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.notes && <p className="text-sm text-gray-700">{a.notes}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}

              <div className="space-y-2 mt-3">
                <input
                  type="text"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Add notes or observations..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <button
                  onClick={handleAddAnnotation}
                  disabled={saving || (!newTags && !newNotes)}
                  className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add Annotation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm">
      <span className="text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-gray-900 capitalize">{value || "—"}</span>
    </div>
  );
}
