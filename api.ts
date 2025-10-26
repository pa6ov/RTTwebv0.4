/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";

// Initialize the Google Gemini AI client
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

/**
 * Sends the image and prompt to the Gemini model for analysis.
 * @param image The base64 encoded image data.
 * @param basePrompt The main prompt from the text file.
 * @param userDescription Optional user-provided context for the image.
 * @returns A promise that resolves with the parsed JSON analysis and grounding sources.
 */
export async function analyzeChart(
    image: { data: string; mimeType: string; },
    basePrompt: string,
    userDescription: string
): Promise<{ json: any; groundingSources: any[] }> {
    
    let fullPrompt = basePrompt;
    if (userDescription) {
      fullPrompt = `User-provided context: "${userDescription}"\n\n${basePrompt}`;
    }

    const textPart = { text: fullPrompt };
    const imagePart = { inlineData: image };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
      config: {
        tools: [{googleSearch: {}}],
      }
    });

    // Extract the JSON object from the model's response text
    let jsonString = response.text;
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error("Could not find a valid JSON object in the model's response. The response was: " + jsonString);
    }
    
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    
    const parsedJson = JSON.parse(jsonString);
    
    // Extract grounding sources for citation
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingSources = groundingChunks?.map(chunk => chunk.web).filter(Boolean) || [];
    
    return { json: parsedJson, groundingSources: groundingSources };
}
