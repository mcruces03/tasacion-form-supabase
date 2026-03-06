import { useRef, useState, useCallback } from 'react';
import { Camera, ImagePlus, Trash2, Loader2, X, AlertTriangle } from 'lucide-react';
import { compressImage } from '../utils/compressImage';

interface ImageUploadProps {
  readonly images: string[];
  readonly onChange: (images: string[]) => void;
  readonly maxImages?: number;
  readonly headers?: Record<string, string>;
}

const BUCKET = 'property-images';

function extractPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

export default function ImageUpload({ images, onChange, maxImages = 20, headers = {} }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (images.length >= maxImages) {
        setError(`Máximo ${maxImages} imágenes permitidas`);
        return;
      }

      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Formato no soportado. Usa JPG, PNG o WebP.');
        return;
      }

      setError(null);
      setUploading(true);
      try {
        const { base64, contentType } = await compressImage(file);

        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, contentType }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

        onChange([...images, data.url]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al subir la imagen');
      } finally {
        setUploading(false);
      }
    },
    [images, maxImages, onChange]
  );

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';

      const remaining = maxImages - images.length;
      const toUpload = files.slice(0, remaining);

      (async () => {
        for (const file of toUpload) {
          await uploadFile(file);
        }
      })();
    },
    [uploadFile, maxImages, images.length]
  );

  const handleDelete = useCallback(
    async (url: string) => {
      setDeletingUrl(url);
      setError(null);
      try {
        const path = extractPathFromUrl(url);
        if (path) {
          await fetch('/api/delete-image', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
          });
        }
        onChange(images.filter((u) => u !== url));
      } catch {
        onChange(images.filter((u) => u !== url));
      } finally {
        setDeletingUrl(null);
      }
    },
    [images, onChange]
  );

  const canAdd = images.length < maxImages && !uploading;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFiles}
      />

      {images.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <img
                src={url}
                alt=""
                role="button"
                tabIndex={0}
                className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                onClick={() => setPreviewUrl(url)}
                onKeyDown={(e) => { if (e.key === 'Enter') setPreviewUrl(url); }}
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                disabled={deletingUrl === url}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
              >
                {deletingUrl === url ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAdd}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-oliva-400 hover:bg-oliva-50 hover:text-oliva-700 disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-600"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-oliva-500" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          {uploading ? 'Subiendo…' : 'Galería'}
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={!canAdd}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-oliva-400 hover:bg-oliva-50 hover:text-oliva-700 disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-600 sm:flex-none sm:px-6"
        >
          <Camera className="h-5 w-5" />
          Cámara
        </button>
      </div>

      {images.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {images.length}/{maxImages} imágenes
        </p>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {previewUrl && (
        <div
          role="dialog"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPreviewUrl(null); }}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
