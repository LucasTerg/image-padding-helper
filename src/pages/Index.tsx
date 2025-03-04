
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImageProcessing } from "@/hooks/useImageProcessing";
import { FileUploadSection } from "@/components/file-upload/FileUploadSection";
import { ProcessingControls } from "@/components/file-upload/ProcessingControls";
import { ImageGrid } from "@/components/images/ImageGrid";
import { ProcessedImageGrid } from "@/components/images/ProcessedImageGrid";
import { normalizeFileName } from "@/utils/fileHelpers";

const Index = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const backgroundRemovalInputRef = useRef<HTMLInputElement>(null);

  const {
    selectedFiles,
    processedImages,
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
  } = useImageProcessing();

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
  }, [setBaseFileName]);

  const handleClearAll = () => {
    clearAll();
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
                <FileUploadSection
                  onFileSelect={(e) => handleFileSelect(e, 'padding')}
                  renameFiles={renameFiles}
                  setRenameFiles={setRenameFiles}
                  baseFileName={baseFileName}
                  setBaseFileName={setBaseFileName}
                  fileInputRef={fileInputRef}
                  fileNameInputRef={fileNameInputRef}
                  mode="padding"
                />
                
                <ProcessingControls
                  selectedFiles={selectedFiles}
                  processedImages={processedImages}
                  isProcessing={isProcessing}
                  isZipping={isZipping}
                  progress={progress}
                  onProcess={processAllImages}
                  onDownload={downloadProcessedImages}
                  onDownloadZip={downloadAllAsZip}
                  onClear={handleClearAll}
                  mode="padding"
                />
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="background">
            <Card className="p-6 mb-8">
              <div className="space-y-6">
                <FileUploadSection
                  onFileSelect={(e) => handleFileSelect(e, 'background')}
                  renameFiles={renameFiles}
                  setRenameFiles={setRenameFiles}
                  baseFileName={baseFileName}
                  setBaseFileName={setBaseFileName}
                  fileInputRef={backgroundRemovalInputRef}
                  fileNameInputRef={fileNameInputRef}
                  mode="background"
                />
                
                <ProcessingControls
                  selectedFiles={selectedFiles}
                  processedImages={processedImages}
                  isProcessing={isProcessing}
                  isZipping={isZipping}
                  progress={progress}
                  onProcess={processAllImages}
                  onDownload={downloadProcessedImages}
                  onDownloadZip={downloadAllAsZip}
                  onClear={handleClearAll}
                  mode="background"
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
        
        <ImageGrid 
          images={selectedFiles} 
          title="Selected Images"
        />
        
        <ProcessedImageGrid
          processedImages={processedImages}
          renameFiles={renameFiles}
          baseFileName={baseFileName}
          removeBackgroundMode={removeBackgroundMode}
        />
      </div>
    </div>
  );
};

export default Index;
