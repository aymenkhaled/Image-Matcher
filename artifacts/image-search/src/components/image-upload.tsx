import React, { useCallback, useState } from "react";
import { UploadCloud, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onUpload: (file: File) => void;
  className?: string;
  isUploading?: boolean;
  value?: File | null;
  text?: React.ReactNode;
}

export function ImageUpload({ onUpload, className, isUploading, value, text }: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const previewUrl = value ? URL.createObjectURL(value) : null;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors cursor-pointer overflow-hidden",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={handleChange}
        disabled={isUploading}
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4" />
          <p className="text-sm font-medium">Processing image...</p>
        </div>
      ) : previewUrl ? (
        <div className="absolute inset-0 w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-0">
            <img src={previewUrl} alt="Preview" className="h-48 w-auto object-contain rounded shadow-lg" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-muted-foreground p-6 text-center">
          <UploadCloud className="h-12 w-12 mb-4 text-muted-foreground/50" />
          <p className="text-base font-semibold mb-1 text-foreground">
            {text || "Drag & drop an image here"}
          </p>
          <p className="text-sm">or click to browse</p>
        </div>
      )}
    </div>
  );
}
