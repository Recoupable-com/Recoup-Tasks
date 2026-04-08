import { wrapText } from "./wrapText";

/** Video frame dimensions */
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;
/** Maximum portion of the frame height captions can use (40%) */
const MAX_CAPTION_HEIGHT_RATIO = 0.4;
/** Minimum font size — below this the text is unreadable */
const MIN_FONT_SIZE = 20;
/** Maximum font size */
const MAX_FONT_SIZE = 42;

/**
 * Calculates the optimal font size, line layout, and vertical position
 * so captions never get cut off regardless of text length.
 *
 * Vertical positioning:
 *   - Short (1-3 lines): bottom of frame
 *   - Medium (4-6 lines): vertically centered
 *   - Long (7+ lines): starts from top area
 *
 * Font auto-shrinks if text doesn't fit within the available space.
 */
export function calculateCaptionLayout(text: string): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  position: "bottom" | "center" | "top";
} {
  const maxHeight = FRAME_HEIGHT * MAX_CAPTION_HEIGHT_RATIO;

  let chosenLines: string[] = [];
  let chosenFontSize = MIN_FONT_SIZE;
  let chosenLineHeight = MIN_FONT_SIZE + 10;

  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const charsPerLine = Math.floor(FRAME_WIDTH * 0.85 / (fontSize * 0.55));
    const lineHeight = fontSize + 10;
    const lines = wrapText(text, charsPerLine);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= maxHeight) {
      chosenLines = lines;
      chosenFontSize = fontSize;
      chosenLineHeight = lineHeight;
      break;
    }
    chosenLines = lines;
    chosenFontSize = fontSize;
    chosenLineHeight = lineHeight;
  }

  let position: "bottom" | "center" | "top";
  if (chosenLines.length <= 3) {
    position = "bottom";
  } else if (chosenLines.length <= 6) {
    position = "center";
  } else {
    position = "top";
  }

  return { lines: chosenLines, fontSize: chosenFontSize, lineHeight: chosenLineHeight, position };
}
