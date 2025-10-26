/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Defines the shape of the application's shared state.
 */
export type AppState = {
    selectedImage: { data: string; mimeType: string; } | null;
    currentLanguage: 'en' | 'bg';
    analysisData: { json: any; groundingSources: any[]; } | null;
    cachedPrompt: string | null;
};

/**
 * The single source of truth for the application's state.
 */
const state: AppState = {
    selectedImage: null,
    currentLanguage: 'en',
    analysisData: null,
    cachedPrompt: null,
};

/**
 * Returns the current state.
 * @returns {AppState} The current application state.
 */
export const getState = (): Readonly<AppState> => state;

/**
 * Updates the state by merging the new state with the existing state.
 * @param {Partial<AppState>} newState An object containing the state properties to update.
 */
export const setState = (newState: Partial<AppState>) => {
    Object.assign(state, newState);
};
