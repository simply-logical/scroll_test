import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function runPythonScript(wrapperScript) {
  const commands = ['python', 'python3'];
  let lastError = '';

  for (const cmd of commands) {
    try {
      const output = execSync(cmd, {
        input: wrapperScript,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return { success: true, output };
    } catch (error) {
      const stderr = error.stderr ? error.stderr.toString() : '';
      const stdout = error.stdout ? error.stdout.toString() : '';
      lastError = stderr || stdout || error.message;
    }
  }

  return { success: false, error: lastError };
}

function executePythonToBase64(pythonCode) {
  if (!pythonCode || !pythonCode.trim()) {
    return { success: false, error: 'Bloco de código Python vazio.' };
  }

  const cleanCode = pythonCode.replace(/\r\n/g, '\n');

  const wrapperScript = `
import sys
import io
import base64
import traceback

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    plt.close('all')
    plt.clf()
    plt.cla()

${cleanCode.split('\n').map(line => '    ' + line).join('\n')}

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close('all')
    buf.seek(0)
    print("SUCCESS:" + base64.b64encode(buf.read()).decode('utf-8'))
except Exception as e:
    err_msg = traceback.format_exc()
    print("ERROR:" + base64.b64encode(err_msg.encode('utf-8')).decode('utf-8'))
`;

  const res = runPythonScript(wrapperScript);

  if (!res.success) {
    return { success: false, error: res.error };
  }

  const output = res.output;
  if (output.includes('SUCCESS:')) {
    const b64 = output.split('SUCCESS:')[1].trim();
    return { success: true, data: `data:image/png;base64,${b64}` };
  } else if (output.includes('ERROR:')) {
    const rawErr = output.split('ERROR:')[1].trim();
    const errorText = Buffer.from(rawErr, 'base64').toString('utf-8');
    return { success: false, error: errorText };
  }

  return { success: false, error: output || 'Erro de execução desconhecido.' };
}


function parsePythonAndTextBlocks(body) {
  if (!body) return [];

  const steps = [];
  let currentStep = { code: null, textNodes: [] };

  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (node.type === 'code' && (node.lang === 'python' || node.lang === 'py' || !node.lang)) {
      if (currentStep.code !== null || currentStep.textNodes.length > 0) {
        steps.push(currentStep);
        currentStep = { code: node.value, textNodes: [] };
      } else {
        currentStep.code = node.value;
      }
      return;
    }

    if (node.children && Array.isArray(node.children) && node.type !== 'paragraph') {
      walk(node.children);
      return;
    }

    if (node.type === 'paragraph' || node.type === 'text' || node.value) {
      currentStep.textNodes.push(node);
    }
  }

  walk(body);

  if (currentStep.code !== null || currentStep.textNodes.length > 0) {
    steps.push(currentStep);
  }

  return steps.filter(s => s.code !== null || s.textNodes.length > 0);
}

function renderNodesToHTML(nodes) {
  if (!nodes) return '';
  if (typeof nodes === 'string') return nodes;
  if (Array.isArray(nodes)) return nodes.map(renderNodesToHTML).join('');
  if (nodes.type === 'text') return nodes.value || '';
  if (nodes.value) return nodes.value;

  const tag = nodes.name || nodes.hName || (nodes.type === 'paragraph' ? 'p' : 'span');
  const childrenHTML = nodes.children ? renderNodesToHTML(nodes.children) : '';

  if (tag === 'paragraph' || tag === 'p') {
    return `<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify; font-size: 15px; color: #1e293b; font-family: sans-serif;">${childrenHTML}</p>`;
  }

  return `<${tag}>${childrenHTML}</${tag}>`;
}

export const dynamicImagesScrollytellingDirective = {
  name: 'dynamic-images-scrollytelling',
  alias: ['dynamicImagesScrollytelling', 'dynamic-scrollytelling'],
  options: {
    title: { type: String },
    imgWidth: { type: String },
  },
  body: {
    type: 'myst',
  },
  run(data) {
    const title = data.options?.title ?? 'Scrollytelling Dinâmico';
    const width = data.options?.imgWidth ?? '380px';

    const stepItems = parsePythonAndTextBlocks(data.body);
    const totalSteps = Math.max(stepItems.length, 1);

    const textSectionsHTML = Array.from({ length: totalSteps }).map((_, index) => {
      const stepIndex = index + 1;
      const item = stepItems[index];
      const blockHTML = item ? renderNodesToHTML(item.textNodes) : '';

      return `
        <div class="step-text" data-index="${index}" style="min-height: 65vh; margin-bottom: 8vh; display: flex; flex-direction: column; justify-content: center; border-left: 4px solid #cbd5e1; padding-left: 24px; transition: all 0.3s ease;">
          <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
            Step ${stepIndex} of ${totalSteps}
          </div>
          <div style="color: #334155; font-size: 15px; line-height: 1.6;">
            ${blockHTML || '<em>(Sem texto explicativo para este passo)</em>'}
          </div>
        </div>
      `;
    }).join('');

    const selectOptionsHTML = Array.from({ length: totalSteps }).map((_, index) => {
      return `<option value="${index}">${index + 1}. Figure ${index + 1}</option>`;
    }).join('');

    const figureLayersHTML = Array.from({ length: totalSteps }).map((_, index) => {
      const item = stepItems[index];
      let visualContent = '';

      if (item && item.code) {
        const pyResult = executePythonToBase64(item.code);
        if (pyResult.success) {
          visualContent = `<img src="${pyResult.data}" alt="Figure ${index + 1}" />`;
        } else {
          visualContent = `
            <div style="color: #ef4444; font-size: 11px; padding: 12px; overflow-y: auto; max-height: 100%; text-align: left; background: #fef2f2; border-radius: 6px; border: 1px solid #fca5a5; font-family: monospace; white-space: pre-wrap; word-break: break-all;">
              <strong>Erro no Python:</strong><br/>${pyResult.error}
            </div>
          `;
        }
      } else {
        visualContent = `<div style="color: #94a3b8; font-size: 12px; text-align: center;">Nenhum código Python neste passo</div>`;
      }

      return `
        <div class="img-layer ${index === 0 ? 'active' : ''}" data-index="${index}">
          ${visualContent}
        </div>
      `;
    }).join('');

    const standaloneHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
          html, body { background: #f8fafc; color: #333; height: 100%; width: 100%; }
          
          .header { padding: 16px 24px; background: #0f172a; color: white; display: flex; justify-content: space-between; align-items: center; }
          .header h3 { margin: 0; font-size: 16px; font-weight: 600; }
          .header span { font-size: 12px; color: #94a3b8; }

          .container { display: flex; gap: 40px; max-width: 1050px; margin: 0 auto; padding: 32px 24px; position: relative; }
          .text-column { flex: 1; min-width: 0; }
          
          .visual-column { 
            flex: 0 0 ${width}; 
            width: ${width}; 
            position: sticky; 
            top: 24px; 
            height: 380px; 
            background: white; 
            border: 1px solid #e2e8f0; 
            border-radius: 12px; 
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); 
            padding: 16px; 
            display: flex; 
            flex-direction: column; 
            align-items: center;
            align-self: flex-start;
          }

          .controls { display: flex; gap: 8px; width: 100%; margin-bottom: 12px; z-index: 10; }
          .controls select { flex: 1; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; background: #fff; cursor: pointer; outline: none; }
          .controls button { padding: 6px 12px; border-radius: 6px; border: none; font-size: 13px; background: #0f172a; color: white; cursor: pointer; font-weight: 500; }

          .img-wrapper { position: relative; width: 100%; height: 250px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          
          .img-layer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: scale(0.92);
            transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out;
            pointer-events: none;
            z-index: 1;
          }

          .img-layer.active {
            opacity: 1;
            transform: scale(1);
            pointer-events: auto;
            z-index: 10;
          }

          .img-layer img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>${title}</h3>
          <span>Dynamic Scrollytelling</span>
        </div>

        <div class="container">
          <div class="text-column">
            <div style="height: 2vh;"></div>
            ${textSectionsHTML}
            <div style="height: 15vh;"></div>
          </div>

          <div class="visual-column">
            <div class="controls">
              <select id="stepSelect">${selectOptionsHTML}</select>
              <button id="syncBtn">Sync</button>
            </div>

            <div class="img-wrapper">
              ${figureLayersHTML}
            </div>

            <div class="caption" id="figCaption" style="margin-top:12px; font-size:13px; color:#2563eb; font-weight:600;">Figure 1 of ${totalSteps}</div>
          </div>
        </div>

        <script>
          (function() {
            const textSteps = Array.from(document.querySelectorAll('.step-text'));
            const imgLayers = Array.from(document.querySelectorAll('.img-layer'));
            const select = document.getElementById('stepSelect');
            const syncBtn = document.getElementById('syncBtn');
            const caption = document.getElementById('figCaption');

            let activeIndex = 0;
            let isAutoScrolling = false;
            let scrollTimer;

            function updateState(index) {
              if (index < 0 || index >= imgLayers.length) return;
              activeIndex = index;

              if (select) select.value = index;
              if (caption) caption.textContent = 'Figure ' + (index + 1) + ' of ' + imgLayers.length;

              imgLayers.forEach((layer, idx) => {
                if (idx === index) layer.classList.add('active');
                else layer.classList.remove('active');
              });

              textSteps.forEach((step, idx) => {
                if (idx === index) {
                  step.style.borderLeftColor = '#2563eb';
                  step.style.background = 'rgba(37, 99, 235, 0.04)';
                } else {
                  step.style.borderLeftColor = '#cbd5e1';
                  step.style.background = 'transparent';
                }
              });
            }

            window.addEventListener('scroll', function() {
              if (isAutoScrolling) return;

              let bestIndex = activeIndex;
              let minDistance = Infinity;
              const focalPoint = window.innerHeight * 0.4;

              textSteps.forEach((step, idx) => {
                const rect = step.getBoundingClientRect();
                const distance = Math.abs((rect.top + rect.height / 2) - focalPoint);

                if (rect.top < window.innerHeight && rect.bottom > 0) {
                  if (distance < minDistance) {
                    minDistance = distance;
                    bestIndex = idx;
                  }
                }
              });

              if (bestIndex !== activeIndex) updateState(bestIndex);
            }, { passive: true });

            if (select) {
              select.addEventListener('change', function(e) {
                const targetIdx = parseInt(e.target.value, 10);
                updateState(targetIdx);
                isAutoScrolling = true;
                clearTimeout(scrollTimer);

                textSteps[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                scrollTimer = setTimeout(() => { isAutoScrolling = false; }, 800);
              });
            }

            if (syncBtn) {
              syncBtn.addEventListener('click', function() {
                updateState(activeIndex);
                textSteps[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }

            updateState(0);
          })();
        </script>
      </body>
      </html>
    `;

    const base64HTML = Buffer.from(standaloneHTML).toString('base64');
    const iframeDataUrl = `data:text/html;base64,${base64HTML}`;

    return [
      {
        type: 'html',
        value: `
          <div style="
            width: min(90vw, 950px);
            height: clamp(800px, 140vh, 3200px);
            position: relative;
            left: 50%;
            transform: translateX(-50%);
            margin: 24px 0;
          ">
            <iframe
              src="${iframeDataUrl}"
              style="
                display: block;
                width: 100%;
                height: 100%;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                background: #f8fafc;
              "
              frameborder="0">
            </iframe>
          </div>
        `
      }
    ];
  },
};

const plugin = { 
  name: 'MyST Dynamic Images Scrollytelling Plugin', 
  directives: [dynamicImagesScrollytellingDirective] 
};

export default plugin;