
import React from "react";
import { Button } from "@/components/ui/button";

interface ProcessedImageGridProps {
  processedImages: Array<{ 
    original: File; 
    processed: Blob | null; 
    dimensions?: { 
      width: number; 
      height: number 
    }; 
    size?: number 
  }>;
  renameFiles: boolean;
  baseFileName: string;
  removeBackgroundMode: boolean;
}

export const ProcessedImageGrid: React.FC<ProcessedImageGridProps> = ({
  processedImages,
  renameFiles,
  baseFileName,
  removeBackgroundMode
}) => {
  if (processedImages.length === 0) return null;

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-xl font-semibold">Processing Results</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {processedImages.map((item, index) => {
          const { original, processed, dimensions, size } = item;
          const needsProcessing = !!processed;
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 
                ${needsProcessing ? 
                  "bg-blue-50 dark:bg-blue-900/30 sepia:bg-amber-100/50" : 
                  "bg-green-50 dark:bg-green-900/30 sepia:bg-amber-200/50"}`
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate" title={original.name}>
                  {original.name}
                </span>
                <span 
                  className={`text-xs px-2 py-1 rounded-full 
                    ${needsProcessing ? 
                      "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 sepia:bg-amber-200 sepia:text-amber-800" : 
                      "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 sepia:bg-amber-300 sepia:text-amber-900"}`
                  }
                >
                  {needsProcessing ? (removeBackgroundMode ? "Background Removed" : "Processed") : "Unchanged"}
                </span>
              </div>
              
              {processed && (
                <div className="mb-2">
                  <div className="rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 mb-2">
                    <img 
                      src={URL.createObjectURL(processed)} 
                      alt="Processed" 
                      className="max-w-full h-auto"
                      onLoad={(e) => {
                        setTimeout(() => URL.revokeObjectURL((e.target as HTMLImageElement).src), 30000);
                      }}
                    />
                  </div>
                  {dimensions && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {dimensions.width} x {dimensions.height}px
                      {size && `, ${(size / 1024 / 1024).toFixed(2)}MB`}
                    </p>
                  )}
                </div>
              )}
              
              {needsProcessing && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="link" 
                    className="p-0 h-auto text-xs"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(processed!);
                      let fileName = original.name;
                      
                      if (renameFiles && baseFileName) {
                        // Extract number from original filename if it exists
                        const numericSuffix = original.name.match(/\d+/);
                        
                        if (numericSuffix) {
                          fileName = `${baseFileName}-${numericSuffix[0]}.jpg`;
                        } else {
                          fileName = `${baseFileName}-${index + 1}.jpg`;
                        }
                      } else {
                        // Still extract number from original filename if it exists
                        const nameWithoutExt = original.name.substring(0, original.name.lastIndexOf('.'));
                        const numericSuffix = nameWithoutExt.match(/(\d+)$/);
                        
                        if (numericSuffix) {
                          // Ensure there's a dash before the number
                          const basePart = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf(numericSuffix[0]));
                          // Remove any existing dash at the end of basePart
                          const cleanBasePart = basePart.endsWith('-') ? basePart : basePart;
                          fileName = `${cleanBasePart}-${numericSuffix[0]}.jpg`;
                        } else {
                          fileName = `${nameWithoutExt}-${index + 1}.jpg`;
                        }
                      }
                      
                      link.download = fileName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(link.href);
                    }}
                  >
                    Download
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
