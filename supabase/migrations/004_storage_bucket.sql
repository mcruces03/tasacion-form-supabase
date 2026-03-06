-- Create the storage bucket for property images (public read access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read (download) of images
CREATE POLICY "Public read property images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

-- Allow service-role uploads (API routes use the service key which bypasses RLS,
-- but this policy is here for documentation completeness)
CREATE POLICY "Service role upload property images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "Service role delete property images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images');
