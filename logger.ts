/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

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

export const logger = new Logger();
