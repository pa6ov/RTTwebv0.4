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
      // The result includes the full data URL, so we split to get only the base64 part
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        mimeType: file.type,
        data: base64Data
      });
    };
    reader.onerror = (err) => reject(err);
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
            throw new Error(`Failed to fetch prompt.txt: ${response.statusText}`);
        }
        const text = await response.text();
        setState({ cachedPrompt: text });
        return text;
    } catch (error) {
        console.error(error);
        throw new Error("Could not load the analysis prompt. Please check prompt.txt exists and the network connection.");
    }
}
