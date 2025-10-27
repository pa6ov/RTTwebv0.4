/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

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
 * Fetches the JSON rules and CSV data, then combines them with a hardcoded
 * base prompt into a single comprehensive prompt for the Gemini model.
 * @returns {Promise<string>} A promise that resolves with the full prompt text.
 */
export async function getPrompt(): Promise<string> {
    const basePrompt = `You are a professional trading analyst specializing in short-term (intraday and daily) technical and fundamental analysis. Your task is to analyze an image of a candlestick chart.

**Part 1: Technical Analysis (Visual)**
- Based on the expert knowledge provided in the JSON and CSV data below, identify the primary candlestick pattern in the provided image.
- Suggest 2-3 additional technical indicators (e.g., RSI, MACD, Moving Averages) that could confirm the identified pattern's signal. Briefly explain why each would be useful for this pattern.

**Part 2: Fundamental Analysis (News)**
- Identify the stock/crypto symbol from the image or from the user-provided context.
- Use Google Search to find relevant, breaking news from the last 12-24 hours from verified, reputable financial news outlets.
- Analyze the sentiment of the news (positive, negative, neutral).

**Part 3: Synthesize and Output for Short-Term Trading**
- Combine your visual technical analysis and fundamental news analysis to provide a comprehensive trading recommendation specifically for **short-term (intraday to 3-day) trading strategies**.
- The news sentiment should adjust the profit probability and trading advice for this short-term context.
- The \`takeProfitLevel\`, \`stopLossLevel\`, and \`takeProfitTimeframe\` (e.g., '15-60 minutes', '1-4 hours') must be appropriate for day trading or swing trading over a few days.
- Provide your complete analysis in a single, raw JSON object. **Do not wrap it in markdown backticks or add any other text before or after the JSON.**

The JSON object must have the following structure. For fields requiring translation, provide an object with "en" and "bg" keys.

- patternName: {"en": "English Pattern Name", "bg": "Bulgarian Pattern Name"}
- signal: {"en": "Buy" | "Sell" | "Neutral", "bg": "Купува" | "Продава" | "Неутрален"}
- profitProbability: A success rate percentage range (e.g., "55-72%"). This is a string and does not need translation.
- confirmationIndicators: {"en": "English indicator advice", "bg": "Bulgarian indicator advice"}
- takeProfitLevel: Suggested take profit price (string, no translation).
- stopLossLevel: Suggested stop loss price (string, no translation).
- takeProfitTimeframe: Suggested timeframe (e.g., "15-60 minutes") (string, no translation).
- tradingAdvice: {"en": "English trading advice", "bg": "Bulgarian trading advice"}
- summary: {"en": "English summary", "bg": "Bulgarian summary"}

Analyze the provided chart image and return ONLY the raw JSON object string. Ensure the specified fields are translated into both English and Bulgarian as shown in the structure above.`;

    // Fetch the knowledge base files in parallel
    const [jsonResponse, csvResponse] = await Promise.all([
        fetch('./application/json'),
        fetch('./candlestick_data.csv')
    ]);

    if (!jsonResponse.ok || !csvResponse.ok) {
        throw new Error('Failed to load knowledge base data files.');
    }

    const jsonRules = await jsonResponse.text();
    const csvData = await csvResponse.text();

    // Combine them into a single, structured prompt
    const fullPrompt = `
${basePrompt}

Here is the expert knowledge base you must use for your analysis. Prioritize this information over your general knowledge.

--- START OF JSON KNOWLEDGE BASE ---
${jsonRules}
--- END OF JSON KNOWLEDGE BASE ---

--- START OF CSV KNOWLEDGE BASE (Flashcard format) ---
${csvData}
--- END OF CSV KNOWLEDGE BASE ---

Now, analyze the provided chart image based on these rules and return ONLY the raw JSON object string as requested in the instructions above.
`;

    return fullPrompt.trim();
}