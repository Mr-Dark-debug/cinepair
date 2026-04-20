import { CONFIG } from './config.js';

class ApiService {
    constructor() {
        this.baseUrl = `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}`;
        this.fallbackData = null;
    }

    getHeaders() {
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (CONFIG.github.token) {
            headers['Authorization'] = `token ${CONFIG.github.token}`;
        }
        return headers;
    }

    async fetchFallback() {
        if (!this.fallbackData) {
            try {
                // Adjust path depending on where the script is called from
                const pathPrefix = window.location.pathname.includes('/pages/') ? '../' : 'website/';
                const response = await fetch(`${pathPrefix}data/fallback.json`);
                this.fallbackData = await response.json();
            } catch (e) {
                console.error("Failed to load fallback data", e);
                return {};
            }
        }
        return this.fallbackData;
    }

    async get(endpoint, fallbackKey) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, { headers: this.getHeaders() });
            if (!response.ok) {
                if (response.status === 403 || response.status === 404) {
                    console.warn(`API rate limit or not found for ${endpoint}. Using fallback.`);
                    const fallback = await this.fetchFallback();
                    return fallback[fallbackKey];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            const fallback = await this.fetchFallback();
            return fallback[fallbackKey];
        }
    }

    async getRepoInfo() { return this.get('', 'repo'); }
    async getReleases() { return this.get('/releases', 'releases'); }
    async getContributors() { return this.get('/contributors?per_page=100', 'contributors'); }
    async getCommitActivity() { return this.get('/stats/commit_activity', 'commits'); }
}

export const api = new ApiService();