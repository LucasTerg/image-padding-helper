
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<{ original: File; processed: Blob | null }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      setProcessedImages([]);
    }
  };

  const processImage = (file: File): Promise<{ original: File; processed: Blob | null }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        if (img.width >= 500 && img.height >= 500) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(img.width, 500);
        canvas.height = Math.max(img.height, 500);
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const x = (canvas.width - img.width) / 2;
        const y = (canvas.height - img.height) / 2;
        
        ctx.drawImage(img, x, y, img.width, img.height);
        
        // Set progressive JPEG for JPG/JPEG files, otherwise use default quality
        const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
        const quality = isJpeg ? 0.85 : undefined; // Use 0.85 quality for JPEGs
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: blob });
        }, file.type, quality);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error(`Could not load image: ${file.name}`);
        resolve({ original: file, processed: null });
      };
      
      img.src = url;
    });
  };

  const processAllImages = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select some images first");
      return;
    }
    
    setIsProcessing(true);
    toast.info(`Processing ${selectedFiles.length} images...`);
    
    try {
      const results = await Promise.all(selectedFiles.map(processImage));
      setProcessedImages(results);
      
      const processedCount = results.filter(r => r.processed).length;
      const unchangedCount = results.length - processedCount;
      
      toast.success(`Done! ${processedCount} images were padded, ${unchangedCount} were unchanged.`);
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred while processing images");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadProcessedImages = () => {
    processedImages.forEach(({ original, processed }) => {
      if (!processed) return;
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(processed);
      link.download = original.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
    
    toast.success("Download started! Images are saved in progressive format for JPG/JPEG files.");
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setProcessedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Image Padding Helper</h1>
        <p className="text-center text-gray-500 mb-8">
          Automatically add white padding to images smaller than 500px
        </p>
        
        <Card className="p-6 mb-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="image-upload" className="block mb-2">Select Images</Label>
              <Input 
                id="image-upload"
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              <p className="text-sm text-gray-500 mt-2">
                Select multiple image files to process
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={processAllImages} 
                disabled={selectedFiles.length === 0 || isProcessing}
                className="flex-1"
              >
                {isProcessing ? "Processing..." : "Process Images"}
              </Button>
              
              <Button 
                onClick={downloadProcessedImages} 
                disabled={processedImages.length === 0 || isProcessing}
                variant="outline"
                className="flex-1"
              >
                Download All
              </Button>
              
              <Button 
                onClick={clearAll} 
                disabled={selectedFiles.length === 0 && processedImages.length === 0}
                variant="destructive"
                className="flex-shrink-0"
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>
        
        {selectedFiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Selected Images ({selectedFiles.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="border rounded-lg p-3 bg-white">
                  <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="max-w-full max-h-full object-contain"
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                  </div>
                  <p className="text-sm truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {processedImages.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-xl font-semibold">Processing Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {processedImages.map((item, index) => {
                const { original, processed } = item;
                const needsPadding = !!processed;
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${needsPadding ? "bg-blue-50" : "bg-green-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate" title={original.name}>
                        {original.name}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${needsPadding ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                        {needsPadding ? "Padded" : "Unchanged"}
                      </span>
                    </div>
                    
                    {needsPadding && (
                      <Button 
                        size="sm" 
                        variant="link" 
                        className="p-0 h-auto text-xs"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = URL.createObjectURL(processed as Blob);
                          link.download = original.name;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(link.href);
                          toast.success(`Downloaded: ${original.name}`);
                        }}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
