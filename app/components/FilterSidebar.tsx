"use client";

import { FilterOptions } from "@/lib/types";

const FILTER_LABELS: Record<string, string> = {
  garment_type: "Garment Type",
  style: "Style",
  material: "Material",
  pattern: "Pattern",
  season: "Season",
  occasion: "Occasion",
  consumer_profile: "Consumer Profile",
  trend_notes: "Trend Notes",
  location_continent: "Continent",
  location_country: "Country",
  location_city: "City",
  designer: "Designer",
  upload_year: "Year",
  upload_month: "Month",
};

interface FilterSidebarProps {
  filters: FilterOptions;
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export default function FilterSidebar({
  filters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  search,
  onSearchChange,
}: FilterSidebarProps) {
  const hasActiveFilters = Object.keys(activeFilters).length > 0 || search;

  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="sticky top-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder='e.g. "elegant summer dress with floral pattern"'
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {Object.entries(filters).map(([key, values]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {FILTER_LABELS[key] || key}
            </label>
            <select
              value={activeFilters[key] || ""}
              onChange={e => onFilterChange(key, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
            >
              <option value="">All</option>
              {values.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ))}

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </aside>
  );
}
