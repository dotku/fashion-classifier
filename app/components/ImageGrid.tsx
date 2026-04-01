"use client";

import { ImageRecord } from "@/lib/types";

interface ImageGridProps {
  images: ImageRecord[];
  onSelect: (image: ImageRecord) => void;
}

export default function ImageGrid({ images, onSelect }: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 py-20">
        <div className="text-center">
          <p className="text-lg mb-2">No images found</p>
          <p className="text-sm">Upload garment photos or adjust your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map(image => (
        <div
          key={image.id}
          className="group cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow bg-white"
          onClick={() => onSelect(image)}
        >
          <div className="aspect-square relative overflow-hidden bg-gray-100">
            <img
              src={`/uploads/${image.filename}`}
              alt={image.original_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="p-3">
            <p className="text-sm font-medium text-gray-900 truncate">
              {image.attributes.garment_type}
            </p>
            <p className="text-[10px] text-gray-300 truncate font-mono">{image.id}</p>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(image as any)._score != null && (
              <div className="mt-1 px-2 py-1 bg-blue-50 rounded text-[10px]">
                <span className="font-mono text-blue-600 font-medium">
                  Score: {Number((image as any)._score).toFixed(4)}
                </span>
                {(image as any)._embeddingText && (
                  <p className="text-gray-500 mt-0.5 line-clamp-3 leading-tight">
                    {String((image as any)._embeddingText)}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {image.attributes.style} &middot; {image.attributes.material}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {image.attributes.color_palette.slice(0, 3).map((color, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                  {color}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
