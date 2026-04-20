export class ChartsManager {
    static renderActivityChart(canvasId, commitData) {
        if (!commitData || !commitData.length) return;
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const labels = commitData.map(w => new Date(w.week * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const data = commitData.map(w => w.total);

        if (!window.Chart) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => this.drawChart(ctx, labels, data);
            document.head.appendChild(script);
        } else {
            this.drawChart(ctx, labels, data);
        }
    }

    static drawChart(ctx, labels, data) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Weekly Commits',
                    data: data,
                    borderColor: '#8a2be2',
                    backgroundColor: 'rgba(138, 43, 226, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffcd00',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#2d3436',
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 10 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [5, 5], color: '#f0f0f0' }
                    }
                }
            }
        });
    }
}