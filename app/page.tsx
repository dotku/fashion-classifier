"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ImageRecord, FilterOptions } from "@/lib/types";
import UploadModal from "./components/UploadModal";
import FilterSidebar from "./components/FilterSidebar";
import ImageGrid from "./components/ImageGrid";
import ImageDetail from "./components/ImageDetail";

export default function Home() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v) params.set(k, v);
    }
    try {
      const res = await fetch(`/api/images?${params}`);
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [debouncedSearch, activeFilters]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch("/api/filters");
      const data = await res.json();
      setFilters(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const handleUploaded = () => {
    fetchImages();
    fetchFilters();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Fashion Inspiration Library</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Filters
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Upload Photos
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - hidden on mobile unless toggled */}
          <div className={`${showFilters ? "block" : "hidden"} lg:block`}>
            <FilterSidebar
              filters={filters}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              onClearFilters={() => { setActiveFilters({}); setSearch(""); }}
              search={search}
              onSearchChange={handleSearchChange}
            />
          </div>

          {/* Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">{images.length} image(s)</p>
                <ImageGrid
                  images={images}
                  onSelect={setSelectedImage}
                  searchQuery={debouncedSearch || undefined}
                  onFeedbackSubmitted={fetchImages}
                />
              </>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      {selectedImage && <ImageDetail image={selectedImage} onClose={() => setSelectedImage(null)} onDeleted={() => { fetchImages(); fetchFilters(); }} />}
    </div>
  );
}
