import React, { useState, useRef, useCallback } from 'react';
import { AspectRatio, ClipLength, Genre, VideoConfig } from '../types';

interface UploadSegmentProps {
  onAnalyze: (config: VideoConfig) => void;
  isProcessing: boolean;
  progress: number;
  timeRemaining: string;
  onCancel: () => void;
}

const UploadSegment: React.FC<UploadSegmentProps> = ({
  onAnalyze,
  isProcessing,
  progress,
  timeRemaining,
  onCancel,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [length, setLength] = useState<ClipLength>(ClipLength.AUTO);
  const [genre, setGenre] = useState<Genre>(Genre.PODCAST);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT);
  const [prompt, setPrompt] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (uploadedFile: File) => {
    // Basic validation (2 hours approx 500MB check is loose, sticking to size for now)
    if (uploadedFile.size > 500 * 1024 * 1024) {
      alert("File size exceeds 500MB limit.");
      return;
    }
    setFile(uploadedFile);
  };

  const handleStartAnalysis = () => {
    if (!file) return;
    onAnalyze({
      file,
      length,
      genre,
      aspectRatio,
      prompt
    });
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full min-h-[600px] animate-fade-in">
        <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden">
            {/* Animated Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse"></div>
            
            <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Analyzing Video</h2>
            <p className="text-zinc-400 text-center mb-8 text-sm">AI is finding the best moments...</p>

            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-500 bg-blue-500/10">
                    Progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-500">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-800">
                <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300 ease-out"></div>
              </div>
              <div className="text-center text-zinc-500 text-xs mt-2">
                 Est. Time Remaining: {timeRemaining}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
                <button 
                    onClick={onCancel}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                >
                    Cancel Analysis
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 mb-4 tracking-tighter">
          PIPEL CLIPPER
        </h1>
        <p className="text-zinc-400 text-lg">Transform long videos into viral shorts instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Upload */}
        <div className="flex flex-col gap-6">
          <div 
            className={`
                relative h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all duration-300
                ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}
                ${file ? 'border-cyan-500/50 bg-cyan-500/5' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
                ref={fileInputRef}
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
                accept="video/*"
            />
            
            {file ? (
                <div className="z-10 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-3 text-cyan-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="font-semibold text-white truncate max-w-[250px]">{file.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button 
                        onClick={(e) => { e.preventDefault(); clearFile(); }}
                        className="mt-4 text-xs text-red-400 hover:text-red-300 z-20 relative pointer-events-auto"
                    >
                        Remove file
                    </button>
                </div>
            ) : (
                <div className="z-10 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <p className="font-semibold text-white">Click or drag video here</p>
                    <p className="text-xs text-zinc-500 mt-2">MP4, MOV up to 2 Hours (Max 500MB)</p>
                </div>
            )}
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
             <label className="block text-sm font-medium text-zinc-400 mb-2">Specific Moments Prompt</label>
             <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Find funny bloopers, or focus on the Q&A section..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
             />
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="flex flex-col gap-6">
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-3">Clip Length</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(ClipLength).map((l) => (
                            <button
                                key={l}
                                onClick={() => setLength(l)}
                                className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${length === l ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-3">Genre</label>
                    <select 
                        value={genre} 
                        onChange={(e) => setGenre(e.target.value as Genre)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    >
                        {Object.values(Genre).map((g) => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-3 flex justify-between">
                        <span>Aspect Ratio</span>
                        <span className="text-xs text-blue-400 font-normal flex items-center gap-1">
                           <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                           Auto Face Detection Active
                        </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(AspectRatio).map((r) => (
                            <button
                                key={r}
                                onClick={() => setAspectRatio(r)}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${aspectRatio === r ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                disabled={!file}
                onClick={handleStartAnalysis}
                className={`
                    w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase transition-all transform hover:scale-[1.02] active:scale-[0.98]
                    ${file 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-900/30 hover:shadow-blue-900/50' 
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    }
                `}
            >
                Generate Clips
            </button>
        </div>
      </div>
    </div>
  );
};

export default UploadSegment;