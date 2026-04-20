import { api } from './api.js';
import { UI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    UI.setupScrollReveal();

    try {
        const repoData = await api.getRepoInfo();
        UI.populateHeader(repoData);

        // Populate Home Page Elements
        if (document.getElementById('repo-desc')) {
            document.getElementById('repo-desc').textContent = repoData.description || 'Welcome to our awesome project.';
        }
        
        if (document.getElementById('stat-stars') && repoData.stargazers_count !== undefined) {
            UI.animateCounter(document.getElementById('stat-stars'), repoData.stargazers_count);
            UI.animateCounter(document.getElementById('stat-forks'), repoData.forks_count);
            UI.animateCounter(document.getElementById('stat-issues'), repoData.open_issues_count);
        }

        // Fetch Releases for download CTA
        const releases = await api.getReleases();
        if (releases && releases.length > 0) {
            const latest = releases[0];
            const btn = document.getElementById('hero-download-btn');
            if (btn) {
                btn.href = latest.html_url || (latest.assets && latest.assets[0] ? latest.assets[0].browser_download_url : 'website/pages/releases.html');
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download ${latest.tag_name}`;
            }
        }

    } catch (e) {
        console.error("Initialization error", e);
    }
});