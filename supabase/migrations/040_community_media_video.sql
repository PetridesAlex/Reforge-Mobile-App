-- Raise community-media size limit so short videos can upload

update storage.buckets
set
  file_size_limit = 83886080,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime'
  ]
where id = 'community-media';
