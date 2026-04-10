export interface LyricSegment {
  start: number;
  end: number;
  text: string;
}

export interface SongLyrics {
  title: string;
  fullLyrics: string;
  segments: LyricSegment[];
}
