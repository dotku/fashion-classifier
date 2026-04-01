"use client";

import { useState } from "react";
import { ImageRecord } from "@/lib/types";

interface ImageGridProps {
  images: ImageRecord[];
  onSelect: (image: ImageRecord) => void;
  searchQuery?: string;
  onFeedbackSubmitted?: () => void;
}

function FeedbackButtons({ imageId, searchQuery, existingRating, onSubmitted }: {
  imageId: string;
  searchQuery: string;
  existingRating: number | null;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(existingRating);
  const [sending, setSending] = useState(false);

  const submitFeedback = async (value: number) => {
    if (sending) return;
    setSending(true);
    try {
      await fetch("/api/search-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, image_id: imageId, rating: value }),
      });
      setRating(value);
      onSubmitted?.();
    } catch (err) {
      console.error("Feedback error:", err);
    }
    setSending(false);
  };

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
      <span className="text-[10px] text-gray-400 mr-1">Rate:</span>
      <button
        onClick={e => { e.stopPropagation(); submitFeedback(2); }}
        className={`px-2 py-1 rounded text-xs font-medium ${rating === 2 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-green-100"}`}
        title="Great match"
      >
        ++
      </button>
      <button
        onClick={e => { e.stopPropagation(); submitFeedback(1); }}
        className={`px-2 py-1 rounded text-xs font-medium ${rating === 1 ? "bg-green-400 text-white" : "bg-gray-200 text-gray-600 hover:bg-green-50"}`}
        title="Good match"
      >
        +
      </button>
      <button
        onClick={e => { e.stopPropagation(); submitFeedback(-1); }}
        className={`px-2 py-1 rounded text-xs font-medium ${rating === -1 ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-orange-50"}`}
        title="Not relevant"
      >
        -
      </button>
      <button
        onClick={e => { e.stopPropagation(); submitFeedback(-2); }}
        className={`px-2 py-1 rounded text-xs font-medium ${rating === -2 ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-red-50"}`}
        title="Completely wrong — hide from results"
      >
        --
      </button>
    </div>
  );
}

export default function ImageGrid({ images, onSelect, searchQuery, onFeedbackSubmitted }: ImageGridProps) {
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
      {images.map(image => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const hasScore = (image as any)._score != null;
        const score = hasScore ? Number((image as any)._score) : null;
        const embeddingText = (image as any)._embeddingText as string | null;
        const existingFeedback = (image as any)._feedback as { rating: number; comment: string } | null;
        /* eslint-enable @typescript-eslint/no-explicit-any */

        return (
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
              {score != null && (
                <div className="mt-1 px-2 py-1 bg-blue-50 rounded text-[10px]">
                  <span className="font-mono text-blue-600 font-medium">
                    Score: {score.toFixed(4)}
                  </span>
                  {existingFeedback && (
                    <span className={`ml-1 font-mono ${existingFeedback.rating > 0 ? "text-green-600" : "text-red-600"}`}>
                      (rated {existingFeedback.rating > 0 ? "+" : ""}{existingFeedback.rating})
                    </span>
                  )}
                  {embeddingText && (
                    <p className="text-gray-500 mt-0.5 line-clamp-3 leading-tight">
                      {embeddingText}
                    </p>
                  )}
                </div>
              )}
              {searchQuery && hasScore && (
                <FeedbackButtons
                  imageId={image.id}
                  searchQuery={searchQuery}
                  existingRating={existingFeedback?.rating ?? null}
                  onSubmitted={onFeedbackSubmitted}
                />
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
        );
      })}
    </div>
  );
}
