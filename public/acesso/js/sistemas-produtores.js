/* Gráficos dos sistemas produtores (sistemas_produtores/index.php), Chart.js local.
   <canvas data-sp-grafico='{"sistema":"","rotulos":[],"volume":[],"chuva":[],"rotulo_chuva":"","afluente":[],"defluente":[],"arquivo":""}'>
   Volume útil em barras, chuva em linha suave, vazões afluente e defluente em linhas retas.
   Três eixos: vazão (m³/s) e volume (%) à esquerda, chuva (mm) à direita.
   <button data-sp-baixar="id-do-canvas"> baixa o gráfico em PNG (fundo branco). */
(function () {
    'use strict';
    if (!window.Chart) return;

    var COR = { volume: '#1a73e8', chuva: '#33d6e0', afluente: '#1e8a3a', defluente: '#c8302a' };
    var numBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
    var FONTE_EIXO = { size: 15 };                    // valores dos eixos x e y
    var FONTE_TITULO = { size: 16, weight: 'bold' };  // títulos dos eixos y

    // Fundo branco no canvas, para o PNG não sair transparente
    var fundoBranco = {
        id: 'spFundoBranco',
        beforeDraw: function (chart) {
            var ctx = chart.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };

    function eixo(titulo, cor, posicao, extra) {
        var e = {
            position: posicao, beginAtZero: true,
            title: { display: true, text: titulo, color: cor, font: FONTE_TITULO },
            ticks: { color: cor, font: FONTE_EIXO, callback: function (v) { return numBR.format(v); } },
            grid: { drawOnChartArea: false }
        };
        for (var k in extra) e[k] = extra[k];
        return e;
    }

    function linha(rotulo, dados, cor, eixoId, suave) {
        return {
            type: 'line', label: rotulo, data: dados, yAxisID: eixoId,
            borderColor: cor, backgroundColor: cor, borderWidth: 2,
            tension: suave ? 0.4 : 0, cubicInterpolationMode: suave ? 'monotone' : 'default',
            pointRadius: 0, pointHoverRadius: 4, pointStyle: 'line', spanGaps: true, fill: false, order: 1
        };
    }

    function montar(canvas, cfg) {
        var s = cfg.sistema;
        canvas._grafico = new Chart(canvas, {
            data: {
                labels: cfg.rotulos,
                datasets: [
                    { type: 'bar', label: s + ' – Volume útil (%)', data: cfg.volume, yAxisID: 'volume',
                      backgroundColor: COR.volume, borderColor: COR.volume, barPercentage: 0.6, pointStyle: 'rect', order: 2, unidade: '%' },
                    Object.assign(linha(s + ' – ' + (cfg.rotulo_chuva || 'Chuva (mm)'), cfg.chuva, COR.chuva, 'chuva', true), { unidade: 'mm' }),
                    Object.assign(linha(s + ' – Vazão afluente (m³/s)', cfg.afluente, COR.afluente, 'vazao', false), { unidade: 'm³/s' }),
                    Object.assign(linha(s + ' – Vazão defluente (m³/s)', cfg.defluente, COR.defluente, 'vazao', false), { unidade: 'm³/s' })
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    // Legenda e tooltip na ordem das séries (volume, chuva, afluente, defluente);
                    // sem o sort, o Chart.js ordena pelo "order" de desenho e o volume (barras, atrás) iria para o fim.
                    legend: { position: 'bottom', labels: { usePointStyle: true, sort: function (a, b) { return a.datasetIndex - b.datasetIndex; } } },
                    tooltip: { itemSort: function (a, b) { return a.datasetIndex - b.datasetIndex; }, callbacks: { label: function (c) {
                        var v = c.parsed.y;
                        return c.dataset.label.replace(/^.* – /, '') + ': ' + (v === null ? '—' : numBR.format(v));
                    } } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#3d4b59', font: FONTE_EIXO } },
                    vazao: eixo('Vazão (m³/s)', '#5b6b7b', 'left', { grid: { drawOnChartArea: true, color: '#e9edf1' } }),
                    volume: eixo('Volume (%)', COR.volume, 'left', {}),
                    chuva: eixo('Chuva (mm)', '#5b6b7b', 'right', {})
                }
            },
            plugins: [fundoBranco]
        });
    }

    document.querySelectorAll('canvas[data-sp-grafico]').forEach(function (c) {
        try { montar(c, JSON.parse(c.getAttribute('data-sp-grafico'))); } catch (e) { /* configuração inválida: ignora */ }
    });

    document.querySelectorAll('[data-sp-baixar]').forEach(function (b) {
        b.addEventListener('click', function () {
            var canvas = document.getElementById(b.getAttribute('data-sp-baixar'));
            if (!canvas || !canvas._grafico) return;
            var cfg = JSON.parse(canvas.getAttribute('data-sp-grafico'));
            var a = document.createElement('a');
            a.href = canvas._grafico.toBase64Image('image/png', 1);
            a.download = (cfg.arquivo || 'grafico') + '.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
        });
    });
})();
