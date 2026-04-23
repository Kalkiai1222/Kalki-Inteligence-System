'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface MultiFileUploaderProps {
  companyId: string;
  projectId: string;
  onUploadSuccess: () => void;
}

type FileStatus = 'pending' | 'hashing' | 'uploading' | 'success' | 'duplicate' | 'error';

interface UploadItem {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  message?: string;
  hash?: string;
  fileUrl?: string; // Set when successful or found duplicate
  fileKey?: string;
}

// Generates SHA-256 for duplicate detection
async function calculateHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function MultiFileUploader({ companyId, projectId, onUploadSuccess }: MultiFileUploaderProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending' as FileStatus,
      progress: 0,
    }));
    setUploads(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/tiff': ['.tiff', '.tif']
    }
  });

  const uploadFiles = async () => {
    setIsProcessing(true);
    const successfulPayloads: any[] = [];

    // Process sequentially or in parallel? Let's do sequentially to avoid browser UI blocking on heavy hashes
    for (let i = 0; i < uploads.length; i++) {
      const item = uploads[i];
      if (item.status === 'success' || item.status === 'duplicate') continue;

      try {
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'hashing', message: 'Detecting duplicates...' } : u));
        
        const fileHash = await calculateHash(item.file);
        
        // 1. Get Presigned URL & Check Duplicate
        const presignRes = await fetch(`/api/companies/${companyId}/projects/${projectId}/blueprints/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.file.name,
            mimeType: item.file.type,
            fileSize: item.file.size,
            fileHash
          })
        });

        const presignData = await presignRes.json();
        if (!presignRes.ok) throw new Error(presignData.error || 'Failed to initialize upload');

        if (presignData.duplicate) {
           setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'duplicate', message: presignData.message, progress: 100 } : u));
           continue; 
        }

        // 2. Upload directly to S3 or Local equivalent Tracking Progress
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading', message: 'Transferring data...', hash: fileHash } : u));
        
        let fileUrl = presignData.fileUrl;
        let fileKey = presignData.fileKey;

        if (presignData.method === 'POST') {
           // Local dev fallback mimicking S3
           const fd = new FormData();
           fd.append('file', item.file);
           const upRes = await axios.post(presignData.uploadUrl, fd, {
             onUploadProgress: (p) => {
               const progress = p.total ? Math.round((p.loaded * 100) / p.total) : 0;
               setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress } : u));
             }
           });
           fileUrl = upRes.data.fileUrl;
        } else {
           // Actual AWS S3 upload
           await axios.put(presignData.uploadUrl, item.file, {
             headers: { 'Content-Type': item.file.type },
             onUploadProgress: (p) => {
               const progress = p.total ? Math.round((p.loaded * 100) / p.total) : 0;
               setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress } : u));
             }
           });
        }

        // Add to successful payloads to register in DB
        successfulPayloads.push({
           name: item.file.name.replace(/\.[^/.]+$/, ""), // Strip extension for set name
           fileUrl,
           fileKey,
           fileSize: item.file.size,
           mimeType: item.file.type,
           fileHash,
           notes: 'Initial upload via Dropzone'
        });

        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'success', progress: 100, message: 'Upload complete' } : u));
      } catch (err: any) {
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'error', message: err.message || 'Transfer failed' } : u));
      }
    }

    // 3. Register successfully uploaded files in the database as Blueprint Sets
    if (successfulPayloads.length > 0) {
       await fetch(`/api/companies/${companyId}/projects/${projectId}/blueprints`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(successfulPayloads)
       });
       onUploadSuccess();
    }

    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="bg-white dark:bg-slate-900 transition-colors p-6 rounded-xl shadow-sm space-y-6 border border-gray-200 dark:border-slate-800">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Drag & drop blueprint files here, or click to select</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Supports PDF, PNG, JPG, TIFF files</p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-700 pb-4">
            <h4 className="font-bold text-gray-900 dark:text-white">Queue: {uploads.length} {uploads.length === 1 ? 'file' : 'files'}</h4>
            <button 
              onClick={uploadFiles} 
              disabled={isProcessing || uploads.every(u => u.status === 'success' || u.status === 'duplicate')}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Upload All'}
            </button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {uploads.map(u => (
              <div key={u.id} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 flex flex-col space-y-3 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 flex-1">
                    {u.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                    {u.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                    {u.status === 'duplicate' && <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                    {(u.status === 'uploading' || u.status === 'hashing') && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />}
                    {(u.status === 'pending') && <UploadCloud className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={u.file.name}>{u.file.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{(u.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div>
                    {u.status !== 'uploading' && u.status !== 'hashing' && u.status !== 'success' && u.status !== 'duplicate' && (
                      <button onClick={() => removeFile(u.id)} className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold ml-2 flex-shrink-0">✕ Remove</button>
                    )}
                  </div>
                </div>

                {u.status !== 'pending' && (
                  <div className="w-full bg-gray-300 dark:bg-slate-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${u.status === 'error' ? 'bg-red-500' : u.status === 'duplicate' ? 'bg-blue-500' : 'bg-green-500'}`} 
                      style={{ width: `${u.progress}%` }} 
                    />
                  </div>
                )}
                {u.message && (
                  <p className={`text-xs font-medium ${u.status === 'error' ? 'text-red-600 dark:text-red-400' : u.status === 'duplicate' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {u.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}