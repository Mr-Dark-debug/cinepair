import { api } from './api.js';

export class UI {
    static formatNumber(num) {
        if (!num) return '0';
        return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
    }

    static formatDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    static formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    static setupScrollReveal() {
        const reveals = document.querySelectorAll('.reveal');
        const revealOnScroll = () => {
            const windowHeight = window.innerHeight;
            reveals.forEach(reveal => {
                const revealTop = reveal.getBoundingClientRect().top;
                if (revealTop < windowHeight - 100) {
                    reveal.classList.add('active');
                }
            });
        };
        window.addEventListener('scroll', revealOnScroll);
        revealOnScroll(); // trigger once on load
    }

    static async populateHeader(repoData) {
        const logoText = document.getElementById('repo-name-logo');
        if (logoText && repoData) {
            logoText.textContent = repoData.name;
        }
    }

    static renderMarkdown(text) {
        if (!text) return '';
        // Very basic markdown parsing for releases/changelogs
        let html = text
            .replace(/^### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^## (.*$)/gim, '<h3>$1</h3>')
            .replace(/^# (.*$)/gim, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2' target='_blank'>$1</a>")
            .replace(/\n/gim, '<br />');
            
        // Basic list items
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
        return html;
    }

    static async animateCounter(element, target, duration = 1500) {
        let start = 0;
        const stepTime = Math.abs(Math.floor(duration / target));
        const timer = setInterval(() => {
            start += Math.ceil(target / 50); // fast increment
            if (start >= target) {
                element.innerText = this.formatNumber(target);
                clearInterval(timer);
            } else {
                element.innerText = this.formatNumber(start);
            }
        }, stepTime > 10 ? stepTime : 10);
    }
}