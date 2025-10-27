/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { logger } from './logger';
import { elements, setLanguage, displayAnalysis, resetUIForNewAnalysis, updateImagePreview, showLoader, hideLoader, showResults, showError, hideError, hideResults } from './ui';
import { getState, setState } from './state';
import { fileToGenerativePart, getPrompt } from './utils';
import { analyzeChart } from './api';
import { translations } from './translations';

/**
 * Handles the selected image file (from picker or clipboard) by updating the UI,
 * converting the file, and setting the application state.
 * @param {File | null} file The image file selected by the user.
 */
async function handleImageFile(file: File | null) {
  if (!file) {
    return;
  }

  await logger.log('Image selected', 'INFO', {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // Reset UI for the new image
  resetUIForNewAnalysis();
  updateImagePreview(file);

  // Convert to base64 and update state
  const generativePart = await fileToGenerativePart(file);
  setState({ selectedImage: generativePart, analysisData: null });

  // Enable the analyze button
  elements.analyzeButton.disabled = false;
}

/**
 * The main analysis function triggered by the 'Analyze' button.
 * It orchestrates fetching the prompt, calling the API, and displaying the results or errors.
 */
async function performAnalysis() {
    const { selectedImage } = getState();
    if (!selectedImage) {
        return;
    }

    await logger.log('Analysis execution started', 'INFO');

    // Reset UI for analysis
    showLoader();
    hideResults();
    hideError();
    elements.analyzeButton.disabled = true;
    setState({ analysisData: null });

    try {
        const basePrompt = getPrompt();
        const userDescription = elements.imageDescription.value.trim();

        await logger.log('Sending prompt to Gemini model', 'PROMPT', { prompt: basePrompt, userContext: userDescription });
        
        const analysisResult = await analyzeChart(selectedImage, basePrompt, userDescription);

        await logger.log('Analysis executed successfully', 'SUCCESS', {
            returnedCode: '200_OK',
            output: JSON.stringify(analysisResult),
        });
        
        setState({ analysisData: analysisResult });
        displayAnalysis();
        showResults();

    } catch (e) {
        let errorCode = 'UNKNOWN_ERROR';
        if (e instanceof Error) {
            if (e.message.includes('API key not valid')) errorCode = 'INVALID_API_KEY';
            else if (e.message.includes('400')) errorCode = '400_BAD_REQUEST';
            else if (e.message.includes("Could not find a valid JSON object")) errorCode = 'INVALID_JSON_RESPONSE';
        }
        
        await logger.log('Analysis execution failed', 'ERROR', {
            returnedCode: errorCode,
            error: e.toString(),
            stack: e instanceof Error ? e.stack : 'N/A',
        });

        console.error(e);
        const { currentLanguage } = getState();
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
        showError(message);
    } finally {
        hideLoader();
        elements.analyzeButton.disabled = false;
    }
}

/**
 * Handles copying the analysis result to the clipboard.
 */
async function handleShare() {
    const { analysisData, currentLanguage } = getState();
    if (!analysisData) return;
  
    const { json: parsedJson } = analysisData;
  
    const getValue = (key: string, translatable: boolean) => {
        if (!parsedJson || typeof parsedJson !== 'object' || !parsedJson[key]) return '';
        if (translatable) {
            return parsedJson[key][currentLanguage] || parsedJson[key]['en'] || '';
        }
        return parsedJson[key] || '';
    };
    
    const t = translations[currentLanguage];
  
    const shareText = `
${t['result-title'].replace('>', '').replace('_', '').trim()}
- ${t['pattern']}: ${getValue('patternName', true)}
- ${t['signal']}: ${getValue('signal', true)}
- ${t['profit-prob']}: ${getValue('profitProbability', false)}
- ${t['take-profit']}: ${getValue('takeProfitLevel', false)}
- ${t['stop-loss']}: ${getValue('stopLossLevel', false)}
- ${t['summary']}: ${getValue('summary', true)}
    `.trim().replace(/^\s+/gm, '');
    
    try {
        await navigator.clipboard.writeText(shareText);
        const originalText = elements.shareButton.textContent;
        const originalKey = elements.shareButton.getAttribute('data-translate-key');
        
        elements.shareButton.removeAttribute('data-translate-key');
        elements.shareButton.textContent = t['copied-msg'];
        elements.shareButton.disabled = true;
        
        setTimeout(() => {
            if (originalKey) {
                elements.shareButton.setAttribute('data-translate-key', originalKey);
            }
            elements.shareButton.textContent = originalText;
            elements.shareButton.disabled = false;
        }, 2000);
        await logger.log('Analysis copied to clipboard', 'SUCCESS');
    } catch (err) {
        console.error('Error copying to clipboard:', err);
        await logger.log('Clipboard copy failed', 'ERROR', { error: err.toString() });
        alert('Could not copy to clipboard.');
    }
}

/**
 * Sets up all the application's event listeners.
 */
function setupEventListeners() {
    elements.langSwitcher.addEventListener('click', () => {
        const { currentLanguage } = getState();
        setLanguage(currentLanguage === 'en' ? 'bg' : 'en');
    });

    elements.imagePicker.addEventListener('change', (event) => {
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

    elements.analyzeButton.addEventListener('click', performAnalysis);

    elements.shareButton.addEventListener('click', handleShare);
}

/**
 * Initializes the application.
 */
function main() {
    setupEventListeners();
    setLanguage('en');
}

// Start the application
main();