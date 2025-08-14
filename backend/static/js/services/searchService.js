import { utils } from '../utils.js';

// Service handling document searches
export const searchService = {
    async performSemanticSearch(jobId, term) {
        try {
            const response = await fetch(`/semantic-search/${jobId}?q=${encodeURIComponent(term)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.matches.map(match => ({ text: match, page: null }));
        } catch (error) {
            console.error('Semantic search error:', error);
            throw error;
        }
    },

    performTextSearch(term, container, isRegex = false) {
        const text = container.textContent || '';
        const regex = isRegex
            ? new RegExp(term, 'gi')
            : new RegExp(utils.escapeRegex(term), 'gi');

        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                text: match[0],
                page: null,
                start: match.index,
                end: match.index + match[0].length
            });

            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }

        return matches;
    }
};

