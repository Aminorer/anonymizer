export class ApiClient {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    request(url, options = {}, rollback) {
        return new Promise((resolve, reject) => {
            this.queue.push({ url, options, rollback, resolve, reject, attempts: 0 });
            this._process();
        });
    }

    async _process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        const item = this.queue.shift();
        try {
            const data = await this._fetchWithRetry(item);
            item.resolve(data);
        } catch (error) {
            if (item.rollback) {
                try { item.rollback(); } catch (_) { /* noop */ }
            }
            if (window.toastService) {
                window.toastService.error(error.message || 'Erreur réseau');
            }
            item.reject(error);
        } finally {
            this.processing = false;
            this._process();
        }
    }

    async _fetchWithRetry(item) {
        const maxRetries = 3;
        while (item.attempts < maxRetries) {
            try {
                const response = await fetch(item.url, item.options);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    return await response.json();
                }
                return await response.text();
            } catch (error) {
                item.attempts++;
                if (item.attempts >= maxRetries) {
                    throw error;
                }
            }
        }
    }
}

export const apiClient = new ApiClient();
