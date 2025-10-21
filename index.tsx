/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

// UI Elements
const imagePicker = document.getElementById('image-picker') as HTMLInputElement;
const analyzeButton = document.getElementById('analyze-button') as HTMLButtonElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const previewContainer = document.getElementById('preview-container') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLPreElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;
const errorMessageEl = document.getElementById('error-message') as HTMLParagraphElement;

let selectedImage: { data: string; mimeType: string; } | null = null;

// Initialize GoogleGenAI
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// Helper function to convert file to base64
function fileToGenerativePart(file: File): Promise<{mimeType: string, data: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
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

// Event Listeners
imagePicker.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }

  // Show preview
  imagePreview.src = URL.createObjectURL(file);
  previewContainer.classList.remove('hidden');

  // Convert to base64
  selectedImage = await fileToGenerativePart(file);
  
  // Enable button
  analyzeButton.disabled = false;
});

analyzeButton.addEventListener('click', async () => {
  if (!selectedImage) {
    return;
  }

  // Reset UI
  loader.classList.remove('hidden');
  resultContainer.classList.add('hidden');
  errorContainer.classList.add('hidden');
  analyzeButton.disabled = true;

  try {
    const textPart = {
      text: `You are a professional trading analyst specializing in Japanese candlestick patterns. Your task is to analyze an image of a candlestick chart and identify the primary candlestick pattern present.
      
      Your analysis should be based on common knowledge of the 50 best candlestick patterns.
      
      Based on the identified pattern, provide the following information in a JSON object:
      - patternName: The name of the pattern.
      - signal: "Buy" for bullish patterns, "Sell" for bearish patterns, or "Neutral" for indecisive patterns.
      - profitProbability: A typical success rate or probability percentage range for the pattern if available in your knowledge base (e.g., "55-72%"). If not available, state "Not available".
      - tradingAdvice: A brief, step-by-step guide on how to trade this pattern.
      - summary: A concise summary of the pattern and its implications.

      Analyze the provided chart image and return ONLY the JSON object conforming to the specified schema.`,
    };

    const imagePart = {
      inlineData: selectedImage
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patternName: { type: Type.STRING },
            signal: { type: Type.STRING },
            profitProbability: { type: Type.STRING },
            tradingAdvice: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["patternName", "signal", "profitProbability", "tradingAdvice", "summary"]
        },
      }
    });

    const parsedJson = JSON.parse(response.text);

    // Format output
    const formattedResult = `**Pattern Identified**: ${parsedJson.patternName}
**Signal**: ${parsedJson.signal}
**Profit Probability**: ${parsedJson.profitProbability}
**Trading Advice**: ${parsedJson.tradingAdvice}
**Summary**: ${parsedJson.summary}`;

    resultEl.textContent = formattedResult.trim();
    resultContainer.classList.remove('hidden');

  } catch (e) {
    console.error(e);
    errorMessageEl.textContent = (e as Error).message;
    errorContainer.classList.remove('hidden');
  } finally {
    loader.classList.add('hidden');
    analyzeButton.disabled = false;
  }
});
