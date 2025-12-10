import React, { useState, useRef } from 'react';
import UploadSegment from './components/UploadSegment';
import PreviewSegment from './components/PreviewSegment';
import { GeneratedClip, VideoConfig } from './types';
import { analyzeVideoForClips } from './services/geminiService';

function App() {
  const [currentSegment, setCurrentSegment] = useState<1 | 2>(1);
  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [videoDuration, setVideoDuration] = useState<number>(600);
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const processingInterval = useRef<number | null>(null);

  // Generate More State
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [iteration, setIteration] = useState(1);
  
  const handleAnalyze = async (videoConfig: VideoConfig) => {
    setConfig(videoConfig);
    setIsProcessing(true);
    setProgress(0);
    setTimeRemaining('Calculating...');
    setIteration(1); // Reset iteration

    // Simulate Upload & Processing Progress
    let currentProgress = 0;
    const totalSimulatedTime = 5000; // 5 seconds for demo
    const intervalTime = 100;
    const steps = totalSimulatedTime / intervalTime;
    
    processingInterval.current = window.setInterval(() => {
        currentProgress += (100 / steps);
        
        // Calculate artificial "Time Remaining"
        const remainingSteps = steps - (currentProgress / (100/steps));
        const secondsLeft = Math.ceil((remainingSteps * intervalTime) / 1000);
        setTimeRemaining(`${secondsLeft} seconds left`);

        if (currentProgress >= 90) {
           // Hold at 90% until API returns
           currentProgress = 90;
        }
        setProgress(currentProgress);
    }, intervalTime);

    // Get Video Duration
    let duration = 600; 
    try {
        if (videoConfig.file) {
            duration = await getVideoDuration(videoConfig.file);
            setVideoDuration(duration);
        }
    } catch (e) {
        console.warn("Could not get duration, using default", e);
    }

    // Call Gemini Service
    try {
        const fileName = videoConfig.file ? videoConfig.file.name : "Untitled Video";
        const generatedClips = await analyzeVideoForClips(
            fileName,
            videoConfig.genre,
            videoConfig.length,
            videoConfig.prompt,
            duration,
            1 // Iteration 1
        );
        
        setClips(generatedClips);
        
        // Complete progress
        setProgress(100);
        setTimeRemaining('Complete');
        setTimeout(() => {
            setIsProcessing(false);
            setCurrentSegment(2);
            if (processingInterval.current) clearInterval(processingInterval.current);
        }, 500);

    } catch (error) {
        console.error("Analysis error", error);
        setIsProcessing(false);
        alert("Failed to analyze video. Please try again.");
        if (processingInterval.current) clearInterval(processingInterval.current);
    }
  };

  const handleCancel = () => {
     if (processingInterval.current) clearInterval(processingInterval.current);
     setIsProcessing(false);
     setProgress(0);
     setConfig(null);
  };

  // Perform a new analysis to get fresh clips
  const handleGenerateMore = async () => {
    if(!config) return;
    
    setIsGeneratingMore(true);
    const nextIteration = iteration + 1;
    setIteration(nextIteration);

    try {
        const fileName = config.file ? config.file.name : "Untitled Video";
        const newClips = await analyzeVideoForClips(
            fileName,
            config.genre,
            config.length,
            config.prompt,
            videoDuration,
            nextIteration
        );

        // Append new clips to the top or list
        setClips(prev => [...newClips, ...prev]);

    } catch (error) {
        console.error("Failed to generate more clips", error);
        alert("Could not generate more clips at this time.");
    } finally {
        setIsGeneratingMore(false);
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };
        video.onerror = reject;
        video.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
        {/* Background Ambient Effect (Blue/Cyan) */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
        </div>

        {currentSegment === 1 && (
            <UploadSegment 
                onAnalyze={handleAnalyze} 
                isProcessing={isProcessing}
                progress={progress}
                timeRemaining={timeRemaining}
                onCancel={handleCancel}
            />
        )}

        {currentSegment === 2 && config && (
            <PreviewSegment 
                originalFile={config.file}
                clips={clips}
                config={config}
                onGenerateMore={handleGenerateMore}
                isGeneratingMore={isGeneratingMore}
                onBack={() => {
                    setCurrentSegment(1);
                    setClips([]);
                }}
            />
        )}
    </div>
  );
}

export default App;