/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { translations } from './translations';
import { getState, setState } from './state';

/**
 * A collection of all DOM elements used in the application.
 */
export const elements = {
    imagePicker: document.getElementById('image-picker') as HTMLInputElement,
    imageDescription: document.getElementById('image-description') as HTMLTextAreaElement,
    analyzeButton: document.getElementById('analyze-button') as HTMLButtonElement,
    imagePreview: document.getElementById('image-preview') as HTMLImageElement,
    analysisCanvas: document.getElementById('analysis-canvas') as HTMLCanvasElement,
    previewContainer: document.getElementById('preview-container') as HTMLDivElement,
    loader: document.getElementById('loader') as HTMLDivElement,
    resultContainer: document.getElementById('result-container') as HTMLDivElement,
    resultEl: document.getElementById('result') as HTMLDivElement,
    errorContainer: document.getElementById('error-container') as HTMLDivElement,
    errorMessageEl: document.getElementById('error-message') as HTMLParagraphElement,
    langSwitcher: document.getElementById('lang-switcher') as HTMLButtonElement,
};

/**
 * Renders the analysis data to the results container.
 */
export function displayAnalysis() {
    elements.resultEl.innerHTML = '';
    const { analysisData, currentLanguage } = getState();

    if (!analysisData) {
        return;
    }

    const { json: parsedJson, groundingSources } = analysisData;

    const getValue = (key: string, translatable: boolean) => {
        if (!parsedJson || !parsedJson[key]) return null;
        if (translatable) {
            return parsedJson[key][currentLanguage] || parsedJson[key]['en'] || null;
        }
        return parsedJson[key];
    };

    const analysisItems = {
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

    for (const [label, value] of Object.entries(analysisItems)) {
        if (value) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('result-item');
            itemDiv.innerHTML = `
                <span class="result-label">${label}: </span>
                <span class="result-value">${value as string}</span>`;
            elements.resultEl.appendChild(itemDiv);
        }
    }

    if (groundingSources && groundingSources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.classList.add('result-item');
        const sourcesList = groundingSources
            .map(source => source && source.uri ? `<li><a href="${source.uri}" target="_blank" rel="noopener noreferrer">${source.title || source.uri}</a></li>` : '')
            .join('');
        
        sourcesDiv.innerHTML = `
            <span class="result-label">${translations[currentLanguage]['info-sources']}: </span>
            <span class="result-value"><ul class="sources-list">${sourcesList}</ul></span>`;
        elements.resultEl.appendChild(sourcesDiv);
    }
}

/**
 * Sets the application's language, updates UI text, and re-renders the analysis.
 * @param {'en' | 'bg'} lang The language to set.
 */
export function setLanguage(lang: 'en' | 'bg') {
    setState({ currentLanguage: lang });
    const domElements = document.querySelectorAll('[data-translate-key]');
    domElements.forEach(el => {
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
    elements.langSwitcher.textContent = lang === 'en' ? 'BG' : 'EN';
    displayAnalysis(); // Re-render analysis with the new language
}

/**
 * Displays the image preview and sets the canvas dimensions.
 * @param {File} file The image file to preview.
 */
export function updateImagePreview(file: File) {
    elements.imagePreview.src = URL.createObjectURL(file);
    elements.previewContainer.classList.remove('hidden');

    elements.imagePreview.onload = () => {
        elements.analysisCanvas.width = elements.imagePreview.offsetWidth;
        elements.analysisCanvas.height = elements.imagePreview.offsetHeight;
        URL.revokeObjectURL(elements.imagePreview.src); // Clean up memory
    };
}

/**
 * Resets the UI before a new image is selected for analysis.
 */
export function resetUIForNewAnalysis() {
    const ctx = elements.analysisCanvas.getContext('2d');
    if (ctx) {
        ctx.clearRect(0, 0, elements.analysisCanvas.width, elements.analysisCanvas.height);
    }
    hideResults();
    hideError();
}

// --- UI Visibility Controls ---
export const showLoader = () => elements.loader.classList.remove('hidden');
export const hideLoader = () => elements.loader.classList.add('hidden');
export const showResults = () => elements.resultContainer.classList.remove('hidden');
export const hideResults = () => elements.resultContainer.classList.add('hidden');

export function showError(message: string) {
    elements.errorMessageEl.textContent = message;
    elements.errorContainer.classList.remove('hidden');
}

export function hideError() {
    elements.errorContainer.classList.add('hidden');
}
