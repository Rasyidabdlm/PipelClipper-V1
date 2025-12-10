export enum ClipLength {
  AUTO = 'Auto',
  SHORT = '<30sec',
  MEDIUM = '30-60sec',
  LONG = '60-90sec',
}

export enum Genre {
  PODCAST = 'Podcast',
  WEBINAR = 'Webinar',
  COMEDY = 'Comedy',
  VLOG = 'Vlog',
  REVIEW = 'Review',
  GAMING = 'Gaming',
  LIVE = 'Live',
  QNA = 'QnA',
  MOTIVATIONAL = 'Motivational',
  OTHERS = 'Others',
}

export enum AspectRatio {
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  SQUARE = '1:1',
  FOUR_FIVE = '4:5',
  FIVE_FOUR = '5:4',
}

export interface VideoConfig {
  file: File | null;
  length: ClipLength;
  genre: Genre;
  aspectRatio: AspectRatio;
  prompt: string;
}

export interface GeneratedClip {
  id: string;
  title: string;
  description: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  viralityScore: number; // 0-100
  tags: string[];
}

export interface AnalysisResult {
  clips: GeneratedClip[];
  videoDuration: number;
}
