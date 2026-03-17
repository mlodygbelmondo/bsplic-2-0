import { ImagePlus, X } from 'lucide-react';

interface SocialImagePreviewProps {
  imageUrl: string;
  imageKb: number;
  onRemove: () => void;
}

export function SocialImagePreview({ imageUrl, imageKb, onRemove }: SocialImagePreviewProps) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5" />
          Zdjęcie po kompresji: {imageKb} KB
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onRemove}
          aria-label="Usuń zdjęcie"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <img
        src={imageUrl}
        alt="Podgląd wklejonego zdjęcia"
        className="max-h-44 rounded-md object-cover border border-border"
      />
    </div>
  );
}
