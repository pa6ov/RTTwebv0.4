/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { setState, getState } from './state';

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
 * Fetches the analysis prompt from an external file.
 * It caches the prompt in the state to avoid redundant network requests.
 * @returns {Promise<string>} A promise that resolves with the prompt text.
 */
export async function getPrompt(): Promise<string> {
    const { cachedPrompt } = getState();
    if (cachedPrompt) {
        return cachedPrompt;
    }
    try {
        const response = await fetch('prompt.txt');
        if (!response.ok) {
            throw new Error(`Failed to fetch prompt.txt: Server responded with status ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        if (!text) {
            throw new Error("The prompt.txt file is empty.");
        }
        setState({ cachedPrompt: text });
        return text;
    } catch (error) {
        console.error("Error fetching prompt:", error);
        let message = "Could not load the analysis prompt. Please check your network connection and ensure 'prompt.txt' exists and is not empty.";
        if (error instanceof Error) {
            // Append original error message for better debugging context
            message += `\nOriginal error: ${error.message}`;
        }
        throw new Error(message);
    }
}