
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import JSZip from "jszip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<{ original: File; processed: Blob | null; dimensions?: { width: number; height: number }; size?: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [renameFiles, setRenameFiles] = useState(true);
  const [baseFileName, setBaseFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [removeBackgroundMode, setRemoveBackgroundMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const backgroundRemovalInputRef = useRef<HTMLInputElement>(null);

  // Normalize filename (remove special characters, spaces to hyphens, etc.)
  const normalizeFileName = (name: string): string => {
    // Replace accented characters with their non-accented equivalents
    const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Replace spaces with hyphens and convert to lowercase
    let processed = normalized.replace(/\s+/g, "-").toLowerCase();
    
    // Replace multiple hyphens with a single one
    processed = processed.replace(/-+/g, "-");
    
    // Remove any characters that aren't alphanumeric, hyphens, or dots
    processed = processed.replace(/[^a-z0-9\-\.]/g, "");
    
    return processed;
  };

  // Handle paste from clipboard for the filename input
  useEffect(() => {
    const handlePaste = () => {
      navigator.clipboard.readText()
        .then(text => {
          if (text && fileNameInputRef.current === document.activeElement) {
            const normalizedText = normalizeFileName(text);
            setBaseFileName(normalizedText);
          }
        })
        .catch(err => {
          console.error("Failed to read clipboard contents: ", err);
        });
    };

    const input = fileNameInputRef.current;
    if (input) {
      input.addEventListener('focus', handlePaste);
      return () => {
        input.removeEventListener('focus', handlePaste);
      };
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      console.log(`Selected ${filesArray.length} files for processing`);
      setSelectedFiles(filesArray);
      setProcessedImages([]);
      setProgress(0);
      
      // Extract base name from the first file
      if (filesArray.length > 0 && renameFiles) {
        const firstFileName = filesArray[0].name.split('.')[0];
        const normalized = normalizeFileName(firstFileName);
        setBaseFileName(normalized);
      }
    }
  };

  const handleBackgroundRemovalSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      console.log(`Selected ${filesArray.length} files for background removal`);
      setSelectedFiles(filesArray);
      setProcessedImages([]);
      setProgress(0);
      setRemoveBackgroundMode(true);
      
      // Extract base name from the first file
      if (filesArray.length > 0 && renameFiles) {
        const firstFileName = filesArray[0].name.split('.')[0];
        const normalized = normalizeFileName(firstFileName);
        setBaseFileName(normalized);
      }
    }
  };

  const processImage = (file: File): Promise<{ original: File; processed: Blob | null; dimensions?: { width: number; height: number }; size?: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        console.log(`Processing image: ${file.name}, original size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        
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
        
        // Initial quality setting
        let quality = isJpeg ? 1.0 : 0.95;
        let attempts = 0;
        const maxAttempts = 10;
        
        const compressAndFinalize = (q: number) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              URL.revokeObjectURL(url);
              resolve({ original: file, processed: null });
              return;
            }
            
            // Check if size is under 3MB limit
            if (blob.size > 3 * 1024 * 1024 && attempts < maxAttempts) {
              attempts++;
              // Reduce quality by 10% for each attempt
              const newQuality = q * 0.9;
              console.log(`Image too large (${(blob.size/1024/1024).toFixed(2)}MB), reducing quality to ${(newQuality*100).toFixed(0)}%`);
              compressAndFinalize(newQuality);
              return;
            }
            
            URL.revokeObjectURL(url);
            
            console.log(`Processed ${file.name}: ${finalWidth}x${finalHeight}px, ${(blob.size/1024/1024).toFixed(2)}MB, quality: ${(quality*100).toFixed(0)}%`);
            
            resolve({ 
              original: file, 
              processed: blob,
              dimensions: { width: targetWidth, height: targetHeight },
              size: blob.size
            });
          }, file.type, quality);
        };
        
        // Start the compression process
        compressAndFinalize(quality);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error(`Cannot load image: ${file.name}`);
        resolve({ original: file, processed: null });
      };
      
      img.src = url;
    });
  };

  const removeBackground = async (file: File): Promise<{ original: File; processed: Blob | null; dimensions?: { width: number; height: number }; size?: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        console.log(`Removing background from: ${file.name}`);
        
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Simple gray background removal (replace gray with white)
        // This is a placeholder - in a real app you would use an actual background removal API
        for (let i = 0; i < data.length; i += 4) {
          // Detect grayish colors (where R, G, B are within ~10% of each other)
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const avg = (r + g + b) / 3;
          const isGrayish = 
            Math.abs(r - avg) < avg * 0.1 && 
            Math.abs(g - avg) < avg * 0.1 && 
            Math.abs(b - avg) < avg * 0.1;
          
          // Replace gray with white
          if (isGrayish && avg > 100 && avg < 235) {
            data[i] = 255;     // R
            data[i + 1] = 255; // G
            data[i + 2] = 255; // B
          }
        }
        
        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Check if the image is JPEG
        const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
        
        canvas.toBlob((blob) => {
          if (!blob) {
            URL.revokeObjectURL(url);
            resolve({ original: file, processed: null });
            return;
          }
          
          URL.revokeObjectURL(url);
          
          resolve({ 
            original: file, 
            processed: blob,
            dimensions: { width: canvas.width, height: canvas.height },
            size: blob.size
          });
        }, file.type, isJpeg ? 1.0 : 0.95); // High quality
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error(`Cannot load image: ${file.name}`);
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
    setProgress(0);
    toast.info(`Processing ${selectedFiles.length} images...`);
    
    try {
      const results = [];
      const totalFiles = selectedFiles.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        let result;
        
        if (removeBackgroundMode) {
          result = await removeBackground(file);
        } else {
          result = await processImage(file);
        }
        
        results.push(result);
        setProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
      
      setProcessedImages(results);
      
      const processedCount = results.filter(r => r.processed).length;
      const unchangedCount = results.length - processedCount;
      
      if (removeBackgroundMode) {
        toast.success(`Done! Background removed from ${processedCount} images.`);
      } else {
        toast.success(`Done! ${processedCount} images processed, ${unchangedCount} were unchanged.`);
      }
      
      setRemoveBackgroundMode(false);
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred while processing images");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadProcessedImages = () => {
    processedImages.forEach(({ original, processed }, index) => {
      if (!processed) return;
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(processed);
      
      // Handle file naming
      let fileName = original.name;
      if (renameFiles && baseFileName) {
        const ext = original.name.split('.').pop();
        // Check if the original name had numeric suffix
        const numericSuffix = original.name.match(/\d+(?=\.[^.]+$)/);
        
        if (numericSuffix) {
          fileName = `${baseFileName}${numericSuffix[0]}.${ext}`;
        } else if (index > 0) {
          fileName = `${baseFileName}-${index + 1}.${ext}`;
        } else {
          fileName = `${baseFileName}.${ext}`;
        }
      }
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
    
    toast.success("Download started!");
  };

  const downloadAllAsZip = async () => {
    if (processedImages.length === 0) {
      toast.error("No processed images to download");
      return;
    }

    setIsZipping(true);
    setProgress(0);
    toast.info("Creating zip file...");

    try {
      const zip = new JSZip();
      const totalFiles = processedImages.length;
      
      // Add all processed images to the zip
      for (let i = 0; i < processedImages.length; i++) {
        const { original, processed } = processedImages[i];
        
        if (processed) {
          // Handle file naming
          let fileName = original.name;
          if (renameFiles && baseFileName) {
            const ext = original.name.split('.').pop();
            // Check if the original name had numeric suffix
            const numericSuffix = original.name.match(/\d+(?=\.[^.]+$)/);
            
            if (numericSuffix) {
              fileName = `${baseFileName}${numericSuffix[0]}.${ext}`;
            } else if (i > 0) {
              fileName = `${baseFileName}-${i + 1}.${ext}`;
            } else {
              fileName = `${baseFileName}.${ext}`;
            }
          }
          
          // Add processed image with custom filename
          zip.file(fileName, processed);
        } else {
          // Add original image since it didn't need processing
          zip.file(original.name, original);
        }
        
        setProgress(Math.round(((i + 1) / totalFiles) * 50)); // First 50% for adding files
      }
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        // Update progress as zip gets generated
        onUpdate: (metadata) => {
          if (metadata.percent) {
            const combinedProgress = 50 + Math.round(metadata.percent / 2); // Last 50% for compression
            setProgress(combinedProgress);
          }
        }
      });
      
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
      setProgress(100);
      // Reset progress after a short delay
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setProcessedImages([]);
    setProgress(0);
    setRemoveBackgroundMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (backgroundRemovalInputRef.current) {
      backgroundRemovalInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">Image Processing Tool</h1>
          <ThemeToggle />
        </div>
        
        <Tabs defaultValue="padding" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="padding">Image Padding</TabsTrigger>
            <TabsTrigger value="background">Background Removal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="padding">
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
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rename-files" 
                    checked={renameFiles} 
                    onCheckedChange={(checked) => setRenameFiles(checked as boolean)}
                  />
                  <Label htmlFor="rename-files">Rename files</Label>
                </div>
                
                {renameFiles && (
                  <div>
                    <Label htmlFor="base-filename" className="block mb-2">Base filename</Label>
                    <Input 
                      id="base-filename"
                      ref={fileNameInputRef}
                      type="text" 
                      value={baseFileName}
                      onChange={(e) => setBaseFileName(normalizeFileName(e.target.value))}
                      placeholder="Enter base filename (click to paste from clipboard)"
                      className="mb-1"
                    />
                    <p className="text-xs text-gray-500">
                      Special characters will be removed, spaces converted to hyphens
                    </p>
                  </div>
                )}
                
                {(isProcessing || isZipping) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{isProcessing ? "Processing images..." : "Creating zip file..."}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={processAllImages} 
                    disabled={selectedFiles.length === 0 || isProcessing || isZipping}
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
          </TabsContent>
          
          <TabsContent value="background">
            <Card className="p-6 mb-8">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="background-upload" className="block mb-2">Select Images</Label>
                  <Input 
                    id="background-upload"
                    ref={backgroundRemovalInputRef}
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleBackgroundRemovalSelect}
                    className="cursor-pointer"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Select images to remove gray backgrounds from
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rename-bg-files" 
                    checked={renameFiles} 
                    onCheckedChange={(checked) => setRenameFiles(checked as boolean)}
                  />
                  <Label htmlFor="rename-bg-files">Rename files</Label>
                </div>
                
                {renameFiles && (
                  <div>
                    <Label htmlFor="base-bg-filename" className="block mb-2">Base filename</Label>
                    <Input 
                      id="base-bg-filename"
                      type="text" 
                      value={baseFileName}
                      onChange={(e) => setBaseFileName(normalizeFileName(e.target.value))}
                      placeholder="Enter base filename"
                      className="mb-1"
                    />
                    <p className="text-xs text-gray-500">
                      Special characters will be removed, spaces converted to hyphens
                    </p>
                  </div>
                )}
                
                {(isProcessing || isZipping) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{isProcessing ? "Removing backgrounds..." : "Creating zip file..."}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={processAllImages} 
                    disabled={selectedFiles.length === 0 || isProcessing || isZipping}
                    className="flex-1"
                  >
                    {isProcessing ? "Processing..." : "Remove Backgrounds"}
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
                
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Note: This is a simple demonstration of background removal. For production use, 
                  you should integrate with a professional background removal API.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
        
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
                              // Don't revoke immediately as we need to display the image
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
                            let fileName = original.name;
                            
                            if (renameFiles && baseFileName) {
                              const ext = original.name.split('.').pop();
                              const numericSuffix = original.name.match(/\d+(?=\.[^.]+$)/);
                              
                              if (numericSuffix) {
                                fileName = `${baseFileName}${numericSuffix[0]}.${ext}`;
                              } else if (index > 0) {
                                fileName = `${baseFileName}-${index + 1}.${ext}`;
                              } else {
                                fileName = `${baseFileName}.${ext}`;
                              }
                            }
                            
                            link.href = URL.createObjectURL(processed as Blob);
                            link.download = fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(link.href);
                            toast.success(`Downloaded: ${fileName}`);
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
        )}
      </div>
    </div>
  );
};

export default Index;
