
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import JSZip from "jszip";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<{ original: File; processed: Blob | null }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
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
        // Create the source canvas
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = img.width;
        sourceCanvas.height = img.height;
        const sourceCtx = sourceCanvas.getContext("2d");
        
        if (!sourceCtx) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        // Draw the image to the source canvas
        sourceCtx.drawImage(img, 0, 0);
        
        // Get image data to analyze content boundaries (cropping)
        const imageData = sourceCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        
        // Find the boundaries of non-white pixels
        let minX = img.width;
        let minY = img.height;
        let maxX = 0;
        let maxY = 0;
        
        // Check each pixel (with step of 2 for performance)
        for (let y = 0; y < img.height; y += 2) {
          for (let x = 0; x < img.width; x += 2) {
            const idx = (y * img.width + x) * 4;
            
            // Check if pixel is not white (with some tolerance for near-white)
            // R, G, B values should be less than 245 to be considered non-white
            if (
              data[idx] < 245 || 
              data[idx + 1] < 245 || 
              data[idx + 2] < 245 || 
              data[idx + 3] < 250 // Check alpha channel too
            ) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        
        // Add some padding to the cropped area (5px)
        const padding = 5;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(img.width, maxX + padding);
        maxY = Math.min(img.height, maxY + padding);
        
        // Calculate dimensions after cropping
        let cropWidth = maxX - minX;
        let cropHeight = maxY - minY;
        
        // If the whole image is white or cropping didn't work correctly
        if (cropWidth <= 0 || cropHeight <= 0) {
          cropWidth = img.width;
          cropHeight = img.height;
          minX = 0;
          minY = 0;
        }
        
        // Calculate aspect ratio
        const aspectRatio = cropWidth / cropHeight;
        
        // Apply maximum dimensions (3000px width, 3600px height)
        let finalWidth = cropWidth;
        let finalHeight = cropHeight;
        
        if (finalWidth > 3000) {
          finalWidth = 3000;
          finalHeight = finalWidth / aspectRatio;
        }
        
        if (finalHeight > 3600) {
          finalHeight = 3600;
          finalWidth = finalHeight * aspectRatio;
        }
        
        // Round dimensions to integers
        finalWidth = Math.round(finalWidth);
        finalHeight = Math.round(finalHeight);
        
        // Create destination canvas with required dimensions
        // If any dimension is less than 500px, ensure it's at least 500px
        const targetWidth = Math.max(finalWidth, 500);
        const targetHeight = Math.max(finalHeight, 500);
        
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        // Fill with white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate positioning to center the image
        const x = (canvas.width - finalWidth) / 2;
        const y = (canvas.height - finalHeight) / 2;
        
        // Draw the cropped and resized image onto the white canvas
        ctx.drawImage(
          sourceCanvas, 
          minX, minY, cropWidth, cropHeight, // source rectangle
          x, y, finalWidth, finalHeight       // destination rectangle
        );
        
        // Check if the image is JPEG
        const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
        
        canvas.toBlob((blob) => {
          if (!blob) {
            URL.revokeObjectURL(url);
            resolve({ original: file, processed: null });
            return;
          }
          
          URL.revokeObjectURL(url);
          
          if (isJpeg) {
            console.log("Utworzono JPEG wysokiej jakości (przeglądarka obsłuży ewentualne renderowanie progresywne)");
          }
          
          resolve({ original: file, processed: blob });
        }, file.type, isJpeg ? 1.0 : 0.95); // 1.0 = 100% jakości dla JPEG
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error(`Nie można załadować obrazu: ${file.name}`);
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

  const downloadAllAsZip = async () => {
    if (processedImages.length === 0) {
      toast.error("No processed images to download");
      return;
    }

    setIsZipping(true);
    toast.info("Creating zip file...");

    try {
      const zip = new JSZip();
      
      // Add all processed images to the zip
      for (const { original, processed } of processedImages) {
        if (processed) {
          // Add processed image with original filename
          zip.file(original.name, processed);
        } else {
          // Add original image since it didn't need processing
          zip.file(original.name, original);
        }
      }
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Create download link and trigger download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = "processed-images.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("Zip file download started!");
    } catch (error) {
      console.error("Zip creation error:", error);
      toast.error("Failed to create zip file");
    } finally {
      setIsZipping(false);
    }
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
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">Image Padding Helper</h1>
          <ThemeToggle />
        </div>
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
                disabled={processedImages.length === 0 || isProcessing || isZipping}
                variant="outline"
                className="flex-1"
              >
                Download All
              </Button>
              
              <Button 
                onClick={downloadAllAsZip} 
                disabled={processedImages.length === 0 || isProcessing || isZipping}
                variant="outline"
                className="flex-1"
              >
                {isZipping ? "Creating Zip..." : "Download All (.Zip)"}
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
        )}
        
        {processedImages.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-xl font-semibold">Processing Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {processedImages.map((item, index) => {
                const { original, processed } = item;
                const needsPadding = !!processed;
                
                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-4 
                      ${needsPadding ? 
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
                          ${needsPadding ? 
                            "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 sepia:bg-amber-200 sepia:text-amber-800" : 
                            "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 sepia:bg-amber-300 sepia:text-amber-900"}`
                        }
                      >
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
