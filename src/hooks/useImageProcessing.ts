
import { useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { removeBackgroundWithAI } from "@/utils/backgroundRemoval";
import { generateFileName } from "@/utils/fileHelpers";

interface ProcessedImage {
  original: File;
  processed: Blob | null;
  dimensions?: { width: number; height: number };
  size?: number;
}

export const useImageProcessing = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [renameFiles, setRenameFiles] = useState(true);
  const [baseFileName, setBaseFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [removeBackgroundMode, setRemoveBackgroundMode] = useState(false);

  const processImage = (file: File): Promise<ProcessedImage> => {
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

  const removeBackground = async (file: File): Promise<ProcessedImage> => {
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
      
      const fileName = generateFileName(original, index, renameFiles, baseFileName);
      
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
          const fileName = generateFileName(original, i, renameFiles, baseFileName);
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
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: 'padding' | 'background') => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      console.log(`Selected ${filesArray.length} files for ${mode === 'padding' ? 'processing' : 'background removal'}`);
      setSelectedFiles(filesArray);
      setProcessedImages([]);
      setProgress(0);
      setRemoveBackgroundMode(mode === 'background');
      
      if (filesArray.length > 0 && renameFiles) {
        const firstFileName = filesArray[0].name.split('.')[0];
        const normalized = normalizeFileName(firstFileName);
        setBaseFileName(normalized);
      }
    }
  };

  return {
    selectedFiles,
    setSelectedFiles,
    processedImages,
    setProcessedImages,
    isProcessing,
    isZipping,
    renameFiles,
    setRenameFiles,
    baseFileName,
    setBaseFileName,
    progress,
    removeBackgroundMode,
    handleFileSelect,
    processAllImages,
    downloadProcessedImages,
    downloadAllAsZip,
    clearAll
  };
};
