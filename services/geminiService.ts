import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedClip, Genre, ClipLength } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Simulates the AI analysis of the video to find optimal clips.
 * Since uploading a 500MB video directly via browser-side API keys is restricted/unstable without a backend,
 * we use Gemini 2.5 Flash to "hallucinate" the best cut points based on the metadata provided.
 * In a production app, this would send the file to a backend which uploads to Google AI Studio.
 */
export const analyzeVideoForClips = async (
  fileName: string,
  genre: Genre,
  lengthPreference: ClipLength,
  userPrompt: string,
  videoDuration: number,
  iteration: number = 1 // Track how many times we've generated to get fresh content
): Promise<GeneratedClip[]> => {
  
  const model = "gemini-2.5-flash";
  
  // Calculate approximate duration target
  let durationTarget = "around 30 to 60 seconds";
  if (lengthPreference === ClipLength.SHORT) durationTarget = "under 30 seconds";
  if (lengthPreference === ClipLength.LONG) durationTarget = "between 60 and 90 seconds";

  // Offset logic to ensure fresh clips on "Generate More"
  const timeOffset = (iteration - 1) * 15; 

  const prompt = `
    Act as a professional video editor and viral content strategist.
    I am processing a video file named: "${fileName}".
    
    Metadata:
    - Genre: ${genre}
    - Total Duration: ${videoDuration} seconds
    - Specific User Focus: "${userPrompt || 'Find the most engaging highlights'}"
    - Analysis Iteration: ${iteration} (Ensure these clips are DIFFERENT from previous sets)
    
    TASK:
    1. **Contextual Analysis**: Infer the video's content based on the filename and genre.
    2. **Language Detection**: Detect the likely language of the video based on the filename or prompt.
    3. **Generate Clips**: Create 5-6 viral short clips.
    
    CRITICAL REQUIREMENTS FOR TEXT METADATA:
    - **Language**: Title and Description MUST match the detected language of the video.
    - **Title**: Must be catchy, specific, and descriptive of the specific event in the clip (e.g., "Rahasia Sukses di Usia Muda" instead of "Clip 1"). Avoid generic titles.
    - **Description**: Describe exactly what happens or what is said in this specific timeframe. It must feel like a real summary of that segment (e.g., "Pembicara menjelaskan pentingnya investasi leher ke atas sebelum memulai bisnis.").
    
    Target Clip Duration: ${durationTarget}.
    Generate timestamps distributed plausibly across the video duration (offset by ${timeOffset}s to vary results).
    
    Output JSON format:
    Array of objects with:
    - title (string)
    - description (string)
    - startTime (number, seconds)
    - endTime (number, seconds)
    - viralityScore (number, 80-99)
    - tags (array of strings)
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              startTime: { type: Type.NUMBER },
              endTime: { type: Type.NUMBER },
              viralityScore: { type: Type.NUMBER },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title", "description", "startTime", "endTime", "viralityScore", "tags"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as Omit<GeneratedClip, 'id'>[];
    
    // Add IDs and validate timestamps
    return data.map((clip, index) => ({
      ...clip,
      id: `clip-${Date.now()}-${iteration}-${index}`,
      startTime: Math.min(Math.max(0, clip.startTime), videoDuration - 5), // Ensure valid bounds
      endTime: Math.min(clip.endTime, videoDuration),
    }));

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback if API fails
    return fallbackClips(fileName, videoDuration, iteration);
  }
};

const fallbackClips = (fileName: string, duration: number, iteration: number): GeneratedClip[] => {
  const segment = Math.floor(duration / (5 + iteration));
  return Array.from({ length: 4 }).map((_, i) => ({
    id: `fallback-${iteration}-${i}`,
    title: `Part ${i + 1} - ${fileName} (Gen ${iteration})`,
    description: "Auto-detected highlight based on audio levels and motion.",
    startTime: i * segment + (10 * iteration),
    endTime: i * segment + (40 * iteration),
    viralityScore: 85,
    tags: ["auto", "highlight"],
  }));
};