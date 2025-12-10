import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, GeneratedClip, VideoConfig } from '../types';

interface PreviewSegmentProps {
  originalFile: File | null;
  clips: GeneratedClip[];
  config: VideoConfig;
  onGenerateMore: () => void;
  onBack: () => void;
  isGeneratingMore?: boolean;
}

const PreviewSegment: React.FC<PreviewSegmentProps> = ({
  originalFile,
  clips,
  config,
  onGenerateMore,
  onBack,
  isGeneratingMore = false,
}) => {
  const [selectedClip, setSelectedClip] = useState<GeneratedClip>(clips[0]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Download states
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Sync selectedClip when clips array updates (e.g. after generate more)
  useEffect(() => {
    // If current selected clip is not in the new clips array, or if it's the first load
    if (clips.length > 0 && !clips.find(c => c.id === selectedClip.id)) {
        setSelectedClip(clips[0]);
    }
  }, [clips, selectedClip.id]);

  // Convert File to URL for playback
  useEffect(() => {
    if (originalFile) {
      const url = URL.createObjectURL(originalFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [originalFile]);

  // Handle Playback within bounds
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Logic for preview loop
      if (!isDownloading) {
          if (video.currentTime >= selectedClip.endTime) {
            video.pause();
            setIsPlaying(false);
            video.currentTime = selectedClip.startTime;
          }
          const duration = selectedClip.endTime - selectedClip.startTime;
          const current = Math.max(0, video.currentTime - selectedClip.startTime);
          setProgress((current / duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [selectedClip, isDownloading]);

  // Reset when clip changes
  useEffect(() => {
    if (videoRef.current && !isDownloading) {
      videoRef.current.currentTime = selectedClip.startTime;
      setIsPlaying(false);
      setProgress(0);
    }
  }, [selectedClip, isDownloading]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case AspectRatio.PORTRAIT: return 'aspect-[9/16]';
      case AspectRatio.LANDSCAPE: return 'aspect-[16/9]';
      case AspectRatio.SQUARE: return 'aspect-square';
      case AspectRatio.FOUR_FIVE: return 'aspect-[4/5]';
      case AspectRatio.FIVE_FOUR: return 'aspect-[5/4]';
      default: return 'aspect-[9/16]';
    }
  };

  const getTargetDimensions = (ratio: AspectRatio) => {
    // Standardizing on 1080p base for quality
    switch (ratio) {
      case AspectRatio.PORTRAIT: return { width: 1080, height: 1920 }; // 9:16
      case AspectRatio.LANDSCAPE: return { width: 1920, height: 1080 }; // 16:9
      case AspectRatio.SQUARE: return { width: 1080, height: 1080 }; // 1:1
      case AspectRatio.FOUR_FIVE: return { width: 1080, height: 1350 }; // 4:5
      case AspectRatio.FIVE_FOUR: return { width: 1350, height: 1080 }; // 5:4
      default: return { width: 1080, height: 1920 };
    }
  };

  const downloadClip = async () => {
    if (!originalFile) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const blob = await renderClip(originalFile, selectedClip, config.aspectRatio, (prog) => {
        setDownloadProgress(prog);
      });

      // Create download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = selectedClip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      // Use mp4 extension for compatibility
      a.download = `pipel_${safeTitle}.mp4`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Rendering failed:", err);
      alert("Could not generate clip. Please try again.");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  /**
   * Core logic to render the specific clip with cropping and trimming.
   * Uses an off-screen video element and canvas to draw frames.
   */
  const renderClip = (
    file: File,
    clip: GeneratedClip,
    ratio: AspectRatio,
    onProgress: (val: number) => void
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // 1. Setup Elements
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      
      // CRITICAL FOR AUDIO: Must be unmuted to be captured by createMediaElementSource
      video.muted = false; 
      video.volume = 1.0;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const { width: targetW, height: targetH } = getTargetDimensions(ratio);
      canvas.width = targetW;
      canvas.height = targetH;

      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }

      // 2. Setup Audio Processing
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();
      let source: MediaElementAudioSourceNode | null = null;

      // 3. Prepare MediaRecorder Stream
      const canvasStream = canvas.captureStream(30); // 30 FPS constant
      
      // Initialize Audio Connection when metadata is ready
      video.onloadedmetadata = () => {
         try {
             source = audioCtx.createMediaElementSource(video);
             source.connect(dest); // Connect to stream destination only
             
             // Add track to stream
             const track = dest.stream.getAudioTracks()[0];
             if(track) canvasStream.addTrack(track);
         } catch(e) {
             console.warn("Audio capture setup failed:", e);
         }
      };

      // Check supported types
      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported('video/mp4')) {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
              mimeType = 'video/webm;codecs=h264';
          } else {
              mimeType = 'video/webm';
          }
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps quality
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        // Cleanup
        video.src = "";
        audioCtx.close();
        resolve(blob);
      };

      // 4. Rendering Loop
      let animationFrameId: number;
      
      const renderFrame = () => {
        if (video.paused || video.ended) {
            // Check if we finished naturally
            if (video.currentTime >= clip.endTime) {
                recorder.stop();
                cancelAnimationFrame(animationFrameId);
                return;
            }
        }

        // Calculate Crop (Center-Center logic)
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        
        if (vw && vh) {
            const videoRatio = vw / vh;
            const targetRatio = targetW / targetH;

            let sx, sy, sWidth, sHeight;

            if (videoRatio > targetRatio) {
            // Video is wider than target: Crop sides
            sHeight = vh;
            sWidth = vh * targetRatio;
            sx = (vw - sWidth) / 2;
            sy = 0;
            } else {
            // Video is taller than target: Crop top/bottom
            sWidth = vw;
            sHeight = vw / targetRatio;
            sx = 0;
            sy = (vh - sHeight) / 2;
            }

            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
        }
        
        // Progress Update
        const currentProgress = ((video.currentTime - clip.startTime) / (clip.endTime - clip.startTime)) * 100;
        onProgress(Math.min(99, Math.max(0, currentProgress)));

        if (video.currentTime >= clip.endTime) {
            // Stop
            video.pause();
            recorder.stop();
            cancelAnimationFrame(animationFrameId);
        } else {
            animationFrameId = requestAnimationFrame(renderFrame);
        }
      };

      // 5. Start Sequence
      video.oncanplay = () => {
         video.oncanplay = null;
         video.currentTime = clip.startTime;
      };

      video.onseeked = () => {
         video.onseeked = null;
         // Ensure we are close to start time
         if (Math.abs(video.currentTime - clip.startTime) < 0.5) {
             recorder.start();
             video.play().then(() => {
                 renderFrame();
             }).catch(e => {
                 console.error("Playback error:", e);
                 reject(e);
             });
         }
      };

      video.onerror = (e) => reject(new Error("Video load error during render"));
      
      // Trigger load (src already set)
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Upload
        </button>
        <h2 className="text-2xl font-bold text-white">
          <span className="text-blue-500">AI</span> Analysis Results
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Preview Player */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center p-4">
             {/* Container for Aspect Ratio */}
             <div className={`relative ${getAspectRatioClass(config.aspectRatio)} max-h-[70vh] w-full overflow-hidden bg-black rounded-lg group shadow-inner shadow-black`}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover transition-transform duration-500"
                  style={{ objectPosition: 'center 20%' }} // Simulating face detection focus
                  onClick={togglePlay}
                  muted={false}
                  playsInline
                />
                
                {/* Simulated Subtitles */}
                <div className="absolute bottom-16 left-0 w-full text-center px-4 pointer-events-none">
                  <span className="bg-black/60 text-white px-2 py-1 rounded text-lg font-bold shadow-lg backdrop-blur-sm">
                    {selectedClip.description.split(" ").slice(0, 5).join(" ")}...
                  </span>
                </div>

                {/* Controls Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                   <button onClick={togglePlay} className="w-16 h-16 bg-blue-600/90 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform backdrop-blur">
                      {isPlaying ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                      ) : (
                        <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                   </button>
                </div>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
                  <div style={{ width: `${progress}%` }} className="h-full bg-blue-500 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"></div>
                  </div>
                </div>

                {/* Downloading Overlay */}
                {isDownloading && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                        <div className="w-64">
                            <div className="flex justify-between text-white text-sm mb-2 font-mono">
                                <span>Rendering Clip...</span>
                                <span>{Math.round(downloadProgress)}%</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div style={{width: `${downloadProgress}%`}} className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"></div>
                            </div>
                            <p className="text-zinc-500 text-xs text-center mt-2">Cropping & Encoding in real-time...</p>
                        </div>
                    </div>
                )}
             </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
            <div>
               <h3 className="text-xl font-bold text-white mb-1">{selectedClip.title}</h3>
               <div className="flex gap-2 mb-2">
                 {selectedClip.tags.map(tag => (
                   <span key={tag} className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">#{tag}</span>
                 ))}
               </div>
               <p className="text-sm text-zinc-500">
                  {Math.round(selectedClip.endTime - selectedClip.startTime)}s • Virality Score: <span className="text-cyan-400 font-bold">{selectedClip.viralityScore}</span>
               </p>
            </div>
            <button 
              onClick={downloadClip}
              disabled={isDownloading}
              className={`
                px-8 py-3 font-bold rounded-lg flex items-center gap-2 shadow-lg whitespace-nowrap transition-all
                ${isDownloading 
                    ? 'bg-zinc-700 text-zinc-400 cursor-wait' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                }
              `}
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rendering...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Clip
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Clips List */}
        <div className="flex flex-col gap-4 h-full">
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-300">Generated Clips</h3>
              <button 
                onClick={onGenerateMore} 
                disabled={isGeneratingMore}
                className={`
                    text-xs font-medium border px-3 py-1 rounded-full transition-all flex items-center gap-2
                    ${isGeneratingMore 
                        ? 'text-zinc-500 border-zinc-700 cursor-wait' 
                        : 'text-blue-400 hover:text-blue-300 border-blue-500/30 hover:bg-blue-500/10'
                    }
                `}
              >
                {isGeneratingMore ? 'Analyzing...' : '+ Generate More'}
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar max-h-[600px]">
              {clips.map((clip) => (
                <div 
                  key={clip.id}
                  onClick={() => !isDownloading && setSelectedClip(clip)}
                  className={`
                    p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] flex gap-3
                    ${selectedClip.id === clip.id 
                        ? 'bg-zinc-800 border-blue-500/50 shadow-lg shadow-blue-900/20' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                    }
                    ${isDownloading ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  <div className="w-20 h-20 bg-zinc-950 rounded-lg flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                    {/* Placeholder Thumbnail - In real app, generate from video */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900"></div>
                    <span className="relative z-10 text-xl font-bold text-zinc-700">▶</span>
                    <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">
                      {Math.round(clip.endTime - clip.startTime)}s
                    </span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <h4 className={`text-sm font-bold mb-1 line-clamp-2 ${selectedClip.id === clip.id ? 'text-white' : 'text-zinc-400'}`}>
                        {clip.title}
                    </h4>
                    <div className="flex items-center gap-2">
                         <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                            <div style={{ width: `${clip.viralityScore}%` }} className={`h-full ${clip.viralityScore > 90 ? 'bg-cyan-400' : 'bg-blue-600'}`}></div>
                         </div>
                         <span className="text-xs text-zinc-600">{clip.viralityScore}</span>
                    </div>
                  </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

export default PreviewSegment;