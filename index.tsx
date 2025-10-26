/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";

/**
 * Logger class for creating structured XML logs.
 * This logger sends logs to a server endpoint and also logs to the browser console.
 */
class Logger {
    private escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    public async log(event: string, type: 'INFO' | 'SUCCESS' | 'ERROR' | 'PROMPT', details?: any) {
        const timestamp = new Date().toISOString();
        
        let detailsXml = '';
        if (details) {
            const detailsString = JSON.stringify(details, null, 2);
            detailsXml = `<details><![CDATA[\n${detailsString}\n]]></details>`;
        }

        const logEntry = `
<log timestamp="${timestamp}" type="${type}">
  <event>${this.escapeXml(event)}</event>
  ${detailsXml}
</log>
        `.trim();

        // Also log to console for development/debugging purposes
        console.log(logEntry);

        // NOTE: This requires a server-side endpoint at '/log' that accepts POST requests
        // with an XML body and writes it to a file. This is a front-end only implementation.
        try {
            await fetch('/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/xml' },
                body: logEntry
            });
        } catch (error) {
            console.error('Logger: Failed to send log to server:', error);
        }
    }
}

const logger = new Logger();

// UI Elements
const imagePicker = document.getElementById('image-picker') as HTMLInputElement;
const imageDescription = document.getElementById('image-description') as HTMLTextAreaElement;
const analyzeButton = document.getElementById('analyze-button') as HTMLButtonElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const analysisCanvas = document.getElementById('analysis-canvas') as HTMLCanvasElement;
const previewContainer = document.getElementById('preview-container') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;
const errorMessageEl = document.getElementById('error-message') as HTMLParagraphElement;
const langSwitcher = document.getElementById('lang-switcher') as HTMLButtonElement;


let selectedImage: { data: string; mimeType: string; } | null = null;
let currentLanguage: 'en' | 'bg' = 'en';
let analysisDataStore: { json: any; groundingSources: any[]; } | null = null;

// Translations
const translations = {
  en: {
    'rtt-title': 'RTT – RoadToTrading',
    'nav-tool': 'Tool',
    'upload-instructions': 'Select chart image to analyze, or paste it from the clipboard.',
    'image-description-placeholder': 'Add any additional context for the image (optional)...',
    'select-file-btn': 'Select File',
    'analyze-btn': 'Analyze',
    'loader-text': 'Analyzing chart...',
    'result-title': '> Analysis Result_',
    'error-title': '> Error',
    'footer-text': '© 2024 RoadToTrading. All rights reserved.',
    'info-sources': 'Information Sources',
    'pattern': 'Pattern Identified',
    'signal': 'Signal',
    'profit-prob': 'Profit Probability',
    'confirm-indicators': 'Suggested Confirmation Indicators',
    'take-profit': 'Take Profit',
    'stop-loss': 'Stop Loss',
    'tp-timeframe': 'Take Profit Timeframe',
    'trading-advice': 'Trading Advice',
    'summary': 'Summary',
    'error-unexpected': 'An unexpected error occurred. Please check the console for details.',
    'error-api-key': 'Your API key is not valid. Please check your configuration.',
    'error-400': 'The request was malformed. The provided image might be invalid, or the model could not return valid JSON.',
    'error-json': "Could not find a valid JSON object in the model's response. The response was: ",
  },
  bg: {
    'rtt-title': 'RTT – RoadToTrading',
    'nav-tool': 'Инструмент',
    'upload-instructions': 'Изберете изображение на графика за анализ или го поставете от клипборда.',
    'image-description-placeholder': 'Добавете допълнителен контекст за изображението (по избор)...',
    'select-file-btn': 'Избор на файл',
    'analyze-btn': 'Анализирай',
    'loader-text': 'Анализиране на графиката...',
    'result-title': '> Резултат от анализа_',
    'error-title': '> Грешка',
    'footer-text': '© 2024 RoadToTrading. Всички права запазени.',
    'info-sources': 'Източници на информация',
    'pattern': 'Идентифициран Патерн',
    'signal': 'Сигнал',
    'profit-prob': 'Вероятност за печалба',
    'confirm-indicators': 'Предложени индикатори за потвърждение',
    'take-profit': 'Вземане на печалба',
    'stop-loss': 'Стоп на загуба',
    'tp-timeframe': 'Времева рамка за печалба',
    'trading-advice': 'Търговски съвет',
    'summary': 'Обобщение',
    'error-unexpected': 'Възникна неочаквана грешка. Моля, проверете конзолата за подробности.',
    'error-api-key': 'Вашият API ключ не е валиден. Моля, проверете конфигурацията си.',
    'error-400': 'Заявката беше неправилно оформена. Предоставеното изображение може да е невалидно или моделът не можа да върне валиден JSON.',
    'error-json': 'В отговора на модела не можа да бъде намерен валиден JSON обект. Отговорът беше: ',
  }
};


// Initialize GoogleGenAI
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

function displayAnalysis() {
    resultEl.innerHTML = '';
    if (!analysisDataStore) {
        return;
    }

    const { json: parsedJson, groundingSources } = analysisDataStore;

    const getValue = (key: string, translatable: boolean) => {
        if (!parsedJson || !parsedJson[key]) return null;
        if (translatable) {
            return parsedJson[key][currentLanguage] || parsedJson[key]['en'] || null;
        }
        return parsedJson[key];
    };

    const analysisData = {
        [translations[currentLanguage]['pattern']]: getValue('patternName', true),
        [translations[currentLanguage]['signal']]: getValue('signal', true),
        [translations[currentLanguage]['profit-prob']]: getValue('profitProbability', false),
        [translations[currentLanguage]['confirm-indicators']]: getValue('confirmationIndicators', true),
        [translations[currentLanguage]['take-profit']]: getValue('takeProfitLevel', false),
        [translations[currentLanguage]['stop-loss']]: getValue('stopLossLevel', false),
        [translations[currentLanguage]['tp-timeframe']]: getValue('takeProfitTimeframe', false),
        [translations[currentLanguage]['trading-advice']]: getValue('tradingAdvice', true),
        [translations[currentLanguage]['summary']]: getValue('summary', true),
    };

    for (const [label, value] of Object.entries(analysisData)) {
        if (value) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('result-item');

            const labelSpan = document.createElement('span');
            labelSpan.classList.add('result-label');
            labelSpan.textContent = `${label}: `;
            itemDiv.appendChild(labelSpan);

            const valueSpan = document.createElement('span');
            valueSpan.classList.add('result-value');
            valueSpan.textContent = value as string;
            itemDiv.appendChild(valueSpan);

            resultEl.appendChild(itemDiv);
        }
    }

    if (groundingSources && groundingSources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.classList.add('result-item');

        const labelSpan = document.createElement('span');
        labelSpan.classList.add('result-label');
        labelSpan.textContent = `${translations[currentLanguage]['info-sources']}: `;
        sourcesDiv.appendChild(labelSpan);

        const valueSpan = document.createElement('span');
        valueSpan.classList.add('result-value');
        
        const sourcesList = document.createElement('ul');
        sourcesList.classList.add('sources-list');
        
        groundingSources.forEach(source => {
            if (source && source.uri) {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = source.uri;
                link.textContent = source.title || source.uri;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                listItem.appendChild(link);
                sourcesList.appendChild(listItem);
            }
        });
        
        valueSpan.appendChild(sourcesList);
        sourcesDiv.appendChild(valueSpan);
        resultEl.appendChild(sourcesDiv);
    }
}

function setLanguage(lang: 'en' | 'bg') {
  currentLanguage = lang;
  const elements = document.querySelectorAll('[data-translate-key]');
  elements.forEach(el => {
    const key = el.getAttribute('data-translate-key') as keyof typeof translations['en'];
    const type = el.getAttribute('data-translate-type');
    if (key && translations[lang][key]) {
      if (type === 'placeholder') {
        (el as HTMLTextAreaElement).placeholder = translations[lang][key];
      } else {
        (el as HTMLElement).textContent = translations[lang][key];
      }
    }
  });
  langSwitcher.textContent = lang === 'en' ? 'BG' : 'EN';
  displayAnalysis();
}

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

  await logger.log('Image selected', 'INFO', {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // Clear previous canvas drawings and results
  const ctx = analysisCanvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
  }
  analysisDataStore = null;
  resultContainer.classList.add('hidden');
  errorContainer.classList.add('hidden');

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
langSwitcher.addEventListener('click', () => {
  setLanguage(currentLanguage === 'en' ? 'bg' : 'en');
});

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
        event.preventDefault();
        await handleImageFile(file);
        break; 
      }
    }
  }
});

let cachedPrompt: string | null = null;
async function getPrompt(): Promise<string> {
    if (cachedPrompt) {
        return cachedPrompt;
    }
    try {
        const response = await fetch('prompt.txt');
        if (!response.ok) {
            throw new Error(`Failed to fetch prompt.txt: ${response.statusText}`);
        }
        const text = await response.text();
        cachedPrompt = text;
        return text;
    } catch (error) {
        console.error(error);
        throw new Error("Could not load the analysis prompt. Please check prompt.txt exists and the network connection.");
    }
}


analyzeButton.addEventListener('click', async () => {
  if (!selectedImage) {
    return;
  }

  await logger.log('Analysis execution started', 'INFO');

  // Reset UI
  loader.classList.remove('hidden');
  resultContainer.classList.add('hidden');
  errorContainer.classList.add('hidden');
  analyzeButton.disabled = true;
  analysisDataStore = null;

  try {
    const basePrompt = await getPrompt();
    const userDescription = imageDescription.value.trim();
    
    let promptText = basePrompt;

    if (userDescription) {
      promptText = `User-provided context: "${userDescription}"\n\n${promptText}`;
    }

    const textPart = { text: promptText };

    const imagePart = {
      inlineData: selectedImage
    };

    await logger.log('Sending prompt to Gemini model', 'PROMPT', { prompt: promptText });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
      config: {
        tools: [{googleSearch: {}}],
      }
    });

    let jsonString = response.text;

    await logger.log('Analysis executed successfully', 'SUCCESS', {
      returnedCode: '200_OK',
      output: jsonString,
    });
    
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error("Could not find a valid JSON object in the model's response. The response was: " + jsonString);
    }
    
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    
    const parsedJson = JSON.parse(jsonString);
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingSources = groundingChunks?.map(chunk => chunk.web).filter(Boolean) || [];
    
    analysisDataStore = { json: parsedJson, groundingSources: groundingSources };

    displayAnalysis();
    resultContainer.classList.remove('hidden');

  } catch (e) {
    let errorCode = 'UNKNOWN_ERROR';
    if (e instanceof Error) {
        if (e.message.includes('API key not valid')) {
            errorCode = 'INVALID_API_KEY';
        } else if (e.message.includes('400')) {
            errorCode = '400_BAD_REQUEST';
        } else if (e.message.includes("Could not find a valid JSON object")) {
            errorCode = 'INVALID_JSON_RESPONSE';
        }
    }
    await logger.log('Analysis execution failed', 'ERROR', {
      returnedCode: errorCode,
      error: e.toString(),
      stack: e instanceof Error ? e.stack : 'N/A',
    });

    console.error(e);
    let message = translations[currentLanguage]['error-unexpected'];
    if (e instanceof Error) {
        if (e.message.includes('API key not valid')) {
            message = translations[currentLanguage]['error-api-key'];
        } else if (e.message.includes('400')) {
            message = translations[currentLanguage]['error-400'];
        } else if (e.message.includes("Could not find a valid JSON object")) {
            const responseText = e.message.split('The response was: ')[1] || '';
            message = translations[currentLanguage]['error-json'] + responseText;
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

// Initialize with default language
setLanguage('en');
