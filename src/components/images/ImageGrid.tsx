
import React from "react";

interface ImageGridProps {
  images: File[];
  title: string;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, title }) => {
  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title} ({images.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((file, index) => (
          <div key={index} className="border rounded-lg p-3 bg-white dark:bg-gray-800 sepia:bg-amber-50">
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 sepia:bg-amber-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
              <img 
                src={URL.createObjectURL(file)} 
                alt={file.name}
                className="max-w-full max-h-full object-contain"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            </div>
            <p className="text-sm truncate" title={file.name}>{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 sepia:text-amber-700">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
