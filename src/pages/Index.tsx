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
import { removeBackgroundWithAI } from "@/utils/backgroundRemoval";

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

  const normalizeFileName = (name: string): string => {
    const polishReplacements = {
      'ą': 'a', 'Ą': 'A',
      'ć': 'c', 'Ć': 'C',
      'ę': 'e', 'Ę': 'E',
      'ł': 'l', 'Ł': 'L',
      'ń': 'n', 'Ń': 'N',
      'ó': 'o', 'Ó': 'O',
      'ś': 's', 'Ś': 'S',
      'ż': 'z', 'Ż': 'Z',
      'ź': 'z', 'Ź': 'Z'
    };
    
    let processed = name;
    for (const [from, to] of Object.entries(polishReplacements)) {
      processed = processed.replace(new RegExp(from, 'g'), to);
    }
    
    processed = processed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    processed = processed.replace(/\s+/g, "-").toLowerCase();
    processed = processed.replace(/-+/g, "-");
    processed = processed.replace(/[^a-z0-9\-\.]/g, "");
    return processed;
  };

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
        
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = img.width;
        sourceCanvas.height = img.height;
        const sourceCtx = sourceCanvas.getContext("2d");
        
        if (!sourceCtx) {
          URL.revokeObjectURL(url);
          resolve({ original: file, processed: null });
          return;
        }
        
        let scaledWidth = img.width;
        let scaledHeight = img.height;
        let needsResize = false;
        
        if (file.size > 3 * 1024 * 1024 && (img.width > 3000 || img.height > 3000)) {
          console.log(`Large file detected (${(file.size/1024/1024).toFixed(2)}MB) with large dimensions. Will resize longest dimension to 3000px.`);
          needsResize = true;
          
          const aspectRatio = img.width / img.height;
          
          if (img.width >= img.height) {
            scaledWidth = 3000;
            scaledHeight = Math.round(scaledWidth / aspectRatio);
          } else {
            scaledHeight = 3000;
            scaledWidth = Math.round(scaledHeight * aspectRatio);
          }
          
          console.log(`Scaling dimensions: ${img.width}x${img.height} -> ${scaledWidth}x${scaledHeight}`);
          
          const scaleCanvas = document.createElement("canvas");
          scaleCanvas.width = scaledWidth;
          scaleCanvas.height = scaledHeight;
          const scaleCtx = scaleCanvas.getContext("2d");
          
          if (scaleCtx) {
            scaleCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            sourceCtx.drawImage(scaleCanvas, 0, 0, scaledWidth, scaledHeight, 0, 0, scaledWidth, scaledHeight);
            sourceCanvas.width = scaledWidth;
            sourceCanvas.height = scaledHeight;
          } else {
            sourceCtx.drawImage(img, 0, 0);
          }
        } else {
          sourceCtx.drawImage(img, 0, 0);
        }
        
        const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const data = imageData.data;
        
        let minX = sourceCanvas.width;
        let minY = sourceCanvas.height;
        let maxX = 0;
        let maxY = 0;
        
        for (let y = 0; y < sourceCanvas.height; y += 2) {
          for (let x = 0; x < sourceCanvas.width; x += 2) {
            const idx = (y * sourceCanvas.width + x) * 4;
            
            if (
              data[idx] < 245 || 
              data[idx + 1] < 245 || 
              data[idx + 2] < 245 || 
              data[idx + 3] < 250
            ) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        
        const padding = 5;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(sourceCanvas.width, maxX + padding);
        maxY = Math.min(sourceCanvas.height, maxY + padding);
        
        let cropWidth = maxX - minX;
        let cropHeight = maxY - minY;
        
        if (cropWidth <= 0 || cropHeight <= 0) {
          cropWidth = sourceCanvas.width;
          cropHeight = sourceCanvas.height;
          minX = 0;
          minY = 0;
        }
        
        const aspectRatio = cropWidth / cropHeight;
        
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
        
        finalWidth = Math.round(finalWidth);
        finalHeight = Math.round(finalHeight);
        
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
        
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const x = (canvas.width - finalWidth) / 2;
        const y = (canvas.height - finalHeight) / 2;
        
        ctx.drawImage(
          sourceCanvas, 
          minX, minY, cropWidth, cropHeight,
          x, y, finalWidth, finalHeight
        );
        
        const isJpeg = true;
        
        let quality = (file.size > 3 * 1024 * 1024 && !needsResize) ? 0.9 : 0.95;
        let attempts = 0;
        const maxAttempts = 10;
        const targetSize = 2.9 * 1024 * 1024;
        
        const compressAndFinalize = (q: number) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              URL.revokeObjectURL(url);
              resolve({ original: file, processed: null });
              return;
            }
            
            if (file.size > 3 * 1024 * 1024 && blob.size > targetSize && attempts < maxAttempts) {
              attempts++;
              const reductionFactor = blob.size > 2 * targetSize ? 0.7 : 0.85;
              const newQuality = q * reductionFactor;
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
          }, "image/jpeg", quality);
        };
        
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
    try {
      console.log(`Usuwanie tła przy użyciu AI dla: ${file.name}`);
      
      const processedBlob = await removeBackgroundWithAI(file);
      
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(processedBlob);
      });
      
      URL.revokeObjectURL(img.src);
      
      return {
        original: file,
        processed: processedBlob,
        dimensions: { width: img.width, height: img.height },
        size: processedBlob.size
      };
    } catch (error) {
      console.error("Błąd podczas usuwania tła:", error);
      toast.error(`Nie udało się usunąć tła dla ${file.name}: ${error instanceof Error ? error.message : "nieznany błąd"}`);
      return { original: file, processed: null };
    }
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
    });
    
    toast.success("Rozpoczęto pobieranie!");
  };

  const downloadAllAsZip = async () => {
    if (processedImages.length === 0) {
      toast.error("Brak przetworzonych obrazów do pobrania");
      return;
    }

    setIsZipping(true);
    setProgress(0);
    toast.info("Tworzenie pliku zip...");

    try {
      const zip = new JSZip();
      const totalFiles = processedImages.length;
      
      for (let i = 0; i < processedImages.length; i++) {
        const { original, processed } = processedImages[i];
        
        if (processed) {
          let fileName = original.name;
          if (renameFiles && baseFileName) {
            // Extract number from original filename if it exists
            const numericSuffix = original.name.match(/\d+/);
            
            if (numericSuffix) {
              fileName = `${baseFileName}-${numericSuffix[0]}.jpg`;
            } else {
              fileName = `${baseFileName}-${i + 1}.jpg`;
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
              fileName = `${nameWithoutExt}-${i + 1}.jpg`;
            }
          }
          
          zip.file(fileName, processed);
        } else {
          const nameWithoutExt = original.name.substring(0, original.name.lastIndexOf('.'));
          const numericSuffix = nameWithoutExt.match(/(\d+)$/);
          let fileName;
          
          if (numericSuffix) {
            // Ensure there's a dash before the number
            const basePart = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf(numericSuffix[0]));
            // Remove any existing dash at the end of basePart
            const cleanBasePart = basePart.endsWith('-') ? basePart : basePart;
            fileName = `${cleanBasePart}-${numericSuffix[0]}.jpg`;
          } else {
            fileName = `${nameWithoutExt}-${i + 1}.jpg`;
          }
          
          zip.file(fileName, original);
        }
        
        setProgress(Math.round(((i + 1) / totalFiles) * 50));
      }
      
      let lastProgress = 50;
      
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      }, (metadata) => {
        if (metadata.percent) {
          const combinedProgress = 50 + Math.round(metadata.percent / 2);
          setProgress(combinedProgress);
          lastProgress = combinedProgress;
        }
      });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = "processed-images.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast.success("Rozpoczęto pobieranie pliku zip!");
    } catch (error) {
      console.error("Błąd tworzenia pliku zip:", error);
      toast.error("Nie udało się utworzyć pliku zip");
    } finally {
      setIsZipping(false);
      setProgress(100);
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
        )}
      </div>
    </div>
  );
};

export default Index;
