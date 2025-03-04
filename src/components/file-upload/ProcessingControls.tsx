
import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ProcessingControlsProps {
  selectedFiles: File[];
  processedImages: Array<{ original: File; processed: Blob | null }>;
  isProcessing: boolean;
  isZipping: boolean;
  progress: number;
  onProcess: () => void;
  onDownload: () => void;
  onDownloadZip: () => void;
  onClear: () => void;
  mode: 'padding' | 'background';
}

export const ProcessingControls: React.FC<ProcessingControlsProps> = ({
  selectedFiles,
  processedImages,
  isProcessing,
  isZipping,
  progress,
  onProcess,
  onDownload,
  onDownloadZip,
  onClear,
  mode
}) => {
  return (
    <>
      {(isProcessing || isZipping) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {isProcessing 
                ? (mode === 'padding' ? "Processing images..." : "Removing backgrounds...") 
                : "Creating zip file..."}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={onProcess} 
          disabled={selectedFiles.length === 0 || isProcessing || isZipping}
          className="flex-1"
        >
          {isProcessing 
            ? "Processing..." 
            : (mode === 'padding' ? "Process Images" : "Remove Backgrounds")}
        </Button>
        
        <Button 
          onClick={onDownload} 
          disabled={processedImages.length === 0 || isProcessing || isZipping}
          variant="outline"
          className="flex-1"
        >
          Download All
        </Button>
        
        <Button 
          onClick={onDownloadZip} 
          disabled={processedImages.length === 0 || isProcessing || isZipping}
          variant="outline"
          className="flex-1"
        >
          {isZipping ? "Creating Zip..." : "Download All (.Zip)"}
        </Button>
        
        <Button 
          onClick={onClear} 
          disabled={selectedFiles.length === 0 && processedImages.length === 0}
          variant="destructive"
          className="flex-shrink-0"
        >
          Clear
        </Button>
      </div>
      
      {mode === 'background' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Note: This is a simple demonstration of background removal. For production use, 
          you should integrate with a professional background removal API.
        </p>
      )}
    </>
  );
};
