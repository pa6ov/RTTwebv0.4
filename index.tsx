/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

// UI Elements
const imagePicker = document.getElementById('image-picker') as HTMLInputElement;
const imageDescription = document.getElementById('image-description') as HTMLTextAreaElement;
const analyzeButton = document.getElementById('analyze-button') as HTMLButtonElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const analysisCanvas = document.getElementById('analysis-canvas') as HTMLCanvasElement;
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

// Handles the selected image file (from picker or clipboard)
async function handleImageFile(file: File | null) {
  if (!file) {
    return;
  }

  // Clear previous canvas drawings
  const ctx = analysisCanvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
  }

  // Show preview
  imagePreview.src = URL.createObjectURL(file);
  previewContainer.classList.remove('hidden');

  // Set canvas size when image loads to match its displayed size
  imagePreview.onload = () => {
    analysisCanvas.width = imagePreview.offsetWidth;
    analysisCanvas.height = imagePreview.offsetHeight;
  };
  
  // Convert to base64
  selectedImage = await fileToGenerativePart(file);
  
  // Enable button
  analyzeButton.disabled = false;
}


// Event Listeners
imagePicker.addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  handleImageFile(file);
});

document.addEventListener('paste', async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        // Prevent browser's default paste action
        event.preventDefault();
        await handleImageFile(file);
        break; // Stop after handling the first image
      }
    }
  }
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
    const userDescription = imageDescription.value.trim();
    
    let promptText = `You are a professional trading analyst specializing in Japanese candlestick patterns. Your task is to analyze an image of a candlestick chart and identify the primary candlestick pattern present.
      
      Your analysis should be based on common knowledge of the 50 best candlestick patterns.
      
      Based on the identified pattern, provide the following information in a JSON object:
      - patternName: The name of the pattern.
      - signal: "Buy" for bullish patterns, "Sell" for bearish patterns, or "Neutral" for indecisive patterns.
      - profitProbability: A typical success rate or probability percentage range for the pattern if available in your knowledge base (e.g., "55-72%"). If not available, state "Not available".
      - takeProfitLevel: A suggested price level or strategy for taking profit based on the pattern (e.g., "$150.25").
      - stopLossLevel: A suggested price level or strategy for a stop loss order based on the pattern (e.g., "$145.50").
      - takeProfitLineY: The y-pixel coordinate on the image for a horizontal "Take Profit" line. For a bullish "Buy" signal, this line must be above the current price/pattern. For a bearish "Sell" signal, it must be below. The image's top edge is y=0.
      - stopLossLineY: The y-pixel coordinate on the image for a horizontal "Stop Loss" line. For a bullish "Buy" signal, this line must be below the current price/pattern. For a bearish "Sell" signal, it must be above.
      - tradingAdvice: A brief, step-by-step guide on how to trade this pattern.
      - summary: A concise summary of the pattern and its implications.

      Analyze the provided chart image and return ONLY the JSON object conforming to the specified schema. The coordinates must be scaled to the original image dimensions.`;

    if (userDescription) {
      promptText = `User-provided context: "${userDescription}"\n\n${promptText}`;
    }

    const textPart = { text: promptText };

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
            takeProfitLevel: { type: Type.STRING },
            stopLossLevel: { type: Type.STRING },
            takeProfitLineY: { type: Type.NUMBER },
            stopLossLineY: { type: Type.NUMBER },
            tradingAdvice: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["patternName", "signal", "profitProbability", "takeProfitLevel", "stopLossLevel", "takeProfitLineY", "stopLossLineY", "tradingAdvice", "summary"]
        },
      }
    });

    const parsedJson = JSON.parse(response.text);

    // Drawing logic
    const ctx = analysisCanvas.getContext('2d');
    if (ctx) {
      // Clear previous drawings
      ctx.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
      
      const scaleY = imagePreview.offsetHeight / imagePreview.naturalHeight;
      const signal = parsedJson.signal;
      const canvasWidth = analysisCanvas.width;
      const canvasHeight = analysisCanvas.height;
    
      // --- Draw Take Profit ---
      if (typeof parsedJson.takeProfitLineY === 'number') {
        const y = parsedJson.takeProfitLineY * scaleY;
        const level = parsedJson.takeProfitLevel;
        const arrow = signal === 'Buy' ? '▲' : '▼';
        const label = `${arrow} Take Profit: ${level}`;
    
        // Shaded Zone
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        if (signal === 'Buy') {
          ctx.fillRect(0, 0, canvasWidth, y);
        } else { // Sell or Neutral
          ctx.fillRect(0, y, canvasWidth, canvasHeight - y);
        }
        
        // Dashed Line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
    
        // Label with background
        ctx.font = 'bold 14px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        const textMetrics = ctx.measureText(label);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(2, y - 20, textMetrics.width + 6, 18);
        ctx.fillStyle = 'rgba(0, 255, 0, 1)';
        ctx.fillText(label, 5, y - 6);
      }
    
      // --- Draw Stop Loss ---
      if (typeof parsedJson.stopLossLineY === 'number') {
        const y = parsedJson.stopLossLineY * scaleY;
        const level = parsedJson.stopLossLevel;
        const arrow = signal === 'Buy' ? '▼' : '▲';
        const label = `${arrow} Stop Loss: ${level}`;
        
        // Shaded Zone
        ctx.fillStyle = 'rgba(255, 77, 77, 0.15)';
         if (signal === 'Buy') {
          ctx.fillRect(0, y, canvasWidth, canvasHeight - y);
        } else { // Sell or Neutral
          ctx.fillRect(0, 0, canvasWidth, y);
        }
    
        // Dashed Line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 77, 77, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
    
        // Label with background
        ctx.font = 'bold 14px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        const textMetrics = ctx.measureText(label);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(2, y + 4, textMetrics.width + 6, 18);
        ctx.fillStyle = 'rgba(255, 77, 77, 1)';
        ctx.fillText(label, 5, y + 18);
      }
    }

    // Format output
    const formattedResult = `Pattern Identified: ${parsedJson.patternName}
Signal: ${parsedJson.signal}
Profit Probability: ${parsedJson.profitProbability}
Take Profit: ${parsedJson.takeProfitLevel}
Stop Loss: ${parsedJson.stopLossLevel}
Trading Advice: ${parsedJson.tradingAdvice}
Summary: ${parsedJson.summary}`;

    resultEl.textContent = formattedResult.trim();
    resultContainer.classList.remove('hidden');

  } catch (e) {
    console.error(e);
    let message = 'An unexpected error occurred. Please check the console for details.';
    if (e instanceof Error) {
        // Check for common API errors by looking at message content
        if (e.message.includes('API key not valid')) {
            message = 'Your API key is not valid. Please check your configuration.';
        } else if (e.message.includes('400')) {
            message = 'The request was malformed. The provided image might be invalid or unsupported.';
        } else {
            message = e.message;
        }
    }
    errorMessageEl.textContent = message;
    errorContainer.classList.remove('hidden');
  } finally {
    loader.classList.add('hidden');
    analyzeButton.disabled = false;
  }
});