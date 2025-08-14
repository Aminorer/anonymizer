// Service responsible for rendering documents in the viewer
export const documentService = {
    _pdf: null,
    _eventListeners: [],

    _registerEvent(target, type, handler) {
        target.addEventListener(type, handler);
        this._eventListeners.push({ target, type, handler });
    },

    async teardown() {
        this._eventListeners.forEach(({ target, type, handler }) =>
            target.removeEventListener(type, handler)
        );
        this._eventListeners = [];

        if (this._pdf) {
            try {
                await this._pdf.destroy();
            } catch (_) {
                // Ignore cleanup errors
            }
            this._pdf = null;
        }
    },

    async renderPDF(url, zoom, container) {
        await this.teardown();
        let success = false;

        try {
            if (!window.pdfjsLib) {
                throw new Error('PDF.js not loaded');
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            this._pdf = pdf;

            container.innerHTML = '';

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: zoom });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.className = 'block mx-auto mb-4 shadow-lg rounded';

                const pageDiv = document.createElement('div');
                pageDiv.className = 'pdf-page relative';
                pageDiv.dataset.page = pageNum;
                pageDiv.appendChild(canvas);
                container.appendChild(pageDiv);

                const renderTask = page.render({ canvasContext: ctx, viewport });
                await renderTask.promise;

                // Example listener to demonstrate cleanup
                const handler = () =>
                    container.dispatchEvent(
                        new CustomEvent('pageclick', { detail: { page: pageNum } })
                    );
                this._registerEvent(pageDiv, 'click', handler);
            }

            success = true;
            return pdf.numPages;
        } catch (error) {
            console.error('PDF render error:', error);
            if (window.toastService) {
                window.toastService.error('Erreur lors du rendu du PDF');
            }
            throw error;
        } finally {
            if (!success) {
                await this.teardown();
            }
        }
    },

    async renderDOCX(url, container) {
        await this.teardown();
        try {
            if (!window.docx) {
                throw new Error('docx-preview not loaded');
            }

            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();

            container.innerHTML = '';

            await docx.renderAsync(arrayBuffer, container, null, {
                className: 'docx-wrapper',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                ignoreLastRenderedPageBreak: true,
                experimental: true,
                trimXmlDeclaration: true
            });

            return 1;
        } catch (error) {
            console.error('DOCX render error:', error);
            if (window.toastService) {
                window.toastService.error('Erreur lors du rendu du DOCX');
            }
            throw error;
        }
    }
};

