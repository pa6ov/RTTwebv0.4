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
 * Fetches the base prompt, JSON rules, and CSV data, then combines them
 * into a single comprehensive prompt for the Gemini model.
 * @returns {Promise<string>} A promise that resolves with the full prompt text.
 */
export async function getPrompt(): Promise<string> {
    // Fetch all the necessary prompt parts in parallel
    const [promptResponse, jsonResponse, csvResponse] = await Promise.all([
        fetch('./prompt.txt'),
        fetch('./application/json'),
        fetch('./candlestick_data.csv')
    ]);

    if (!promptResponse.ok || !jsonResponse.ok || !csvResponse.ok) {
        throw new Error('Failed to load prompt data files.');
    }

    const basePrompt = await promptResponse.text();
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
