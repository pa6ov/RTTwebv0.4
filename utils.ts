/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const PROMPT_TEXT = `You are a professional trading analyst specializing in technical and fundamental analysis. Your task is to analyze an image of a candlestick chart.

**Part 1: Technical Analysis (Visual)**
- Based on expert knowledge from resources like "The Ultimate Candlestick Patterns PDF" and "The Candlestick Trading Bible", identify the primary candlestick pattern in the provided image.
- Suggest 2-3 additional technical indicators (e.g., RSI, MACD, Moving Averages) that could confirm the identified pattern's signal. Briefly explain why each would be useful for this pattern.

**Part 2: Fundamental Analysis (News)**
- Identify the stock/crypto symbol from the image or from the user-provided context.
- Use Google Search to find relevant, recent news (from the last 48 hours) about this asset.
- Analyze the sentiment of the news (positive, negative, neutral).

**Part 3: Synthesize and Output**
- Combine your visual technical analysis and fundamental news analysis to provide a comprehensive trading recommendation.
- The news sentiment should adjust the profit probability and trading advice.
- Provide your complete analysis in a single, raw JSON object. **Do not wrap it in markdown backticks or add any other text before or after the JSON.**

The JSON object must have the following structure. For fields requiring translation, provide an object with "en" and "bg" keys.

- patternName: {"en": "English Pattern Name", "bg": "Bulgarian Pattern Name"}
- signal: {"en": "Buy" | "Sell" | "Neutral", "bg": "Купува" | "Продава" | "Неутрален"}
- profitProbability: A success rate percentage range (e.g., "55-72%"). This is a string and does not need translation.
- confirmationIndicators: {"en": "English indicator advice", "bg": "Bulgarian indicator advice"}
- takeProfitLevel: Suggested take profit price (string, no translation).
- stopLossLevel: Suggested stop loss price (string, no translation).
- takeProfitTimeframe: Suggested timeframe (e.g., "30-60 minutes") (string, no translation).
- tradingAdvice: {"en": "English trading advice", "bg": "Bulgarian trading advice"}
- summary: {"en": "English summary", "bg": "Bulgarian summary"}

Analyze the provided chart image and return ONLY the raw JSON object string. Ensure the specified fields are translated into both English and Bulgarian as shown in the structure above.`;

/**
 * Converts a File object to a base64 encoded string for the Gemini API.
 * @param {File} file The file to convert.
 * @returns {Promise<{mimeType: string, data: string}>} A promise that resolves with the generative part.
 */
export function fileToGenerativePart(file: File): Promise<{mimeType: string, data: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result || !result.startsWith('data:')) {
          reject(new Error('Invalid file format or failed to read file as data URL.'));
          return;
      }
      
      const parts = result.split(',');
      if (parts.length < 2 || !parts[1]) {
          reject(new Error('Could not extract base64 data from file. The file might be empty or corrupt.'));
          return;
      }

      const base64Data = parts[1];
      resolve({
        mimeType: file.type,
        data: base64Data
      });
    };
    reader.onerror = () => reject(new Error(`Error reading file: ${reader.error?.message || 'Unknown error'}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns the analysis prompt.
 * The prompt is now hardcoded to avoid network requests.
 * @returns {Promise<string>} A promise that resolves with the prompt text.
 */
export async function getPrompt(): Promise<string> {
    return PROMPT_TEXT;
}