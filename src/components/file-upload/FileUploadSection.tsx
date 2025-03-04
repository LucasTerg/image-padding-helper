
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeFileName } from "@/utils/fileHelpers";

interface FileUploadSectionProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  renameFiles: boolean;
  setRenameFiles: (value: boolean) => void;
  baseFileName: string;
  setBaseFileName: (value: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  fileNameInputRef: React.RefObject<HTMLInputElement>;
  mode: 'padding' | 'background';
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onFileSelect,
  renameFiles,
  setRenameFiles,
  baseFileName,
  setBaseFileName,
  fileInputRef,
  fileNameInputRef,
  mode
}) => {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor={`${mode}-upload`} className="block mb-2">Select Images</Label>
        <Input 
          id={`${mode}-upload`}
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          multiple 
          onChange={onFileSelect}
          className="cursor-pointer"
        />
        <p className="text-sm text-gray-500 mt-2">
          {mode === 'padding' 
            ? "Select multiple image files to process" 
            : "Select images to remove gray backgrounds from"}
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox 
          id={`rename-${mode}-files`} 
          checked={renameFiles} 
          onCheckedChange={(checked) => setRenameFiles(checked as boolean)}
        />
        <Label htmlFor={`rename-${mode}-files`}>Rename files</Label>
      </div>
      
      {renameFiles && (
        <div>
          <Label htmlFor={`base-${mode}-filename`} className="block mb-2">Base filename</Label>
          <Input 
            id={`base-${mode}-filename`}
            ref={mode === 'padding' ? fileNameInputRef : undefined}
            type="text" 
            value={baseFileName}
            onChange={(e) => setBaseFileName(normalizeFileName(e.target.value))}
            placeholder={mode === 'padding' 
              ? "Enter base filename (click to paste from clipboard)" 
              : "Enter base filename"}
            className="mb-1"
          />
          <p className="text-xs text-gray-500">
            Special characters will be removed, spaces converted to hyphens
          </p>
        </div>
      )}
    </div>
  );
};
