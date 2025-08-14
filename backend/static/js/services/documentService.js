// Service responsible for rendering documents in the viewer
export const documentService = {
    async renderPDF(url, zoom, container) {
        try {
            if (!window.pdfjsLib) {
                throw new Error('PDF.js not loaded');
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;

            container.innerHTML = '';

            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: zoom * 1.5 });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.className = 'block mx-auto shadow-lg rounded';

            container.appendChild(canvas);
            await page.render({ canvasContext: ctx, viewport }).promise;

            return pdf.numPages;
        } catch (error) {
            console.error('PDF render error:', error);
            if (window.toastService) {
                window.toastService.error('Erreur lors du rendu du PDF');
            }
            throw error;
        }
    },

    async renderDOCX(url, container) {
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

