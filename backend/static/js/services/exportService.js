// Service handling document export
export const exportService = {
    async exportDocument(jobId, options = {}) {
        try {
            const response = await fetch(`/export/${jobId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    watermark: options.watermark || '',
                    audit: options.audit || false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.download_url) {
                window.location.href = data.download_url;
                if (window.toastService) {
                    window.toastService.success('Document exporté avec succès');
                }
            }

            if (data.audit_url) {
                window.open(data.audit_url, '_blank');
            }

            return data;
        } catch (error) {
            console.error('Export error:', error);
            if (window.toastService) {
                window.toastService.error("Erreur lors de l'export");
            }
            throw error;
        }
    }
};

