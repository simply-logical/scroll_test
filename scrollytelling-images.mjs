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
    return { success: false, error: 'No python code.' };
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
    plt.savefig(buf, format='png', bbox_inches='tight', transparent=True)
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
    return `<p class="step-p">${childrenHTML}</p>`;
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
    const iframeId = 'iframe-' + Math.random().toString(36).substring(2, 9);

    const stepItems = parsePythonAndTextBlocks(data.body);
    const totalSteps = Math.max(stepItems.length, 1);

    const textSectionsHTML = Array.from({ length: totalSteps }).map((_, index) => {
      const stepIndex = index + 1;
      const item = stepItems[index];
      const blockHTML = item ? renderNodesToHTML(item.textNodes) : '';

      return `
        <div class="step-text" data-index="${index}">
          <div class="step-label">
            Step ${stepIndex} of ${totalSteps}
          </div>
          <div class="step-body">
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
            <div class="error-msg">
              <strong>Erro no Python:</strong><br/>${pyResult.error}
            </div>
          `;
        }
      } else {
        visualContent = `<div class="empty-msg">Nenhum código Python neste passo</div>`;
      }

      return `
        <div class="img-layer ${index === 0 ? 'active' : ''}" data-index="${index}">
          ${visualContent}
        </div>
      `;
    }).join('');

    const rawHTMLContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    }

    :root, :root.light, html.light, body.light {
      --bg-card: #ffffff;
      --text-color: #2d3444;
      --text-muted: #475569;
      --border-color: #cbd5e1;
      --primary-accent: #2563eb;
      --select-bg: #ffffff;
      --select-text: #0f172a;
      --step-bg-active: rgba(37, 99, 235, 0.06);
      --img-container-bg: #f8fafc;
      background: transparent;
    }

    :root.dark, html.dark, body.dark {
      --bg-card: #1e293b !important;
      --text-color: #ffffff !important;
      --text-muted: #cbd5e1 !important;
      --border-color: #334155 !important;
      --primary-accent: #60a5fa !important;
      --select-bg: #0f172a !important;
      --select-text: #ffffff !important;
      --step-bg-active: rgba(96, 165, 250, 0.12) !important;
      --img-container-bg: #0f172a !important;
    }

    body {
      color: var(--text-color);
    }

    .header { 
      padding: 24px 44px; 
      background: #0f172a; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-top-left-radius: 16px; 
      border-top-right-radius: 16px; 
    }
    .header h3 { color: #ffffff !important; font-size: 1.45rem; font-weight: 600; }
    .header span { color: #94a3b8 !important; font-size: 1.1rem; }

    .container { 
      display: flex; 
      flex-direction: row; 
      gap: 28px; 
      width: 100%; 
      max-width: 3300px; 
      margin: 0 auto; 
      padding: 60px 5px; 
      position: relative; 
    }
    
    .text-column { 
      flex: 1; 
      min-width: 0; 
    }
    
    /* Altura vertical de cada passo expandida para 75vh para preencher mais a tela */
    .step-text { 
      min-height: 75vh; 
      margin-bottom: 8vh; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      border-left: 6px solid var(--border-color); 
      padding: 1px 10px; 
      border-radius: 0 14px 14px 0;
      transition: all 0.3s ease; 
    }

    .step-label { 
      font-size: 16px; 
      font-weight: 700; 
      color: var(--primary-accent) !important;
      text-transform: uppercase; 
      margin-bottom: 18px; 
      letter-spacing: 0.8px; 
    }

    .step-body, .step-p, .step-body * {
      color: var(--text-color) !important;
    }

    .step-p {
      margin: 0 0 12px 0; 
      text-align: justify; 
      line-height: 1.6;
      font-size: 19px; 
    }

    /* Card visual expandido verticalmente para 70vh */
    .visual-column { 
      flex: 1; 
      min-width: 0; 
      position: sticky; 
      top: 0px; 
      height: clamp(90vh, 70vh, 850px); 
      background: var(--bg-card); 
      border: 1px solid var(--border-color); 
      border-radius: 16px; 
      padding: 15px; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      align-self: flex-start;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      transition: background-color 0.3s ease, border-color 0.3s ease;
      z-index: 20;
    }

    .controls { display: flex; gap: 14px; width: 100%; margin-bottom: 18px; z-index: 10; }
    .controls select { 
      flex: 1; 
      padding: 12px 16px; 
      border-radius: 10px; 
      border: 1px solid var(--border-color); 
      font-size: 17px; 
      background: var(--select-bg); 
      color: var(--select-text) !important; 
      cursor: pointer; 
      outline: none; 
    }

    .controls button { 
      padding: 12px 22px; 
      border-radius: 10px; 
      border: none; 
      font-size: 17px; 
      background: var(--primary-accent); 
      color: #ffffff !important; 
      cursor: pointer; 
      font-weight: 600; 
    }

    .img-wrapper { 
      position: relative; 
      width: 100%; 
      flex: 1; 
      overflow: hidden; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      background: var(--img-container-bg); 
      border-radius: 12px; 
      padding: 14px; 
      border: 1px solid var(--border-color);
      transition: background-color 0.3s ease;
    }
    
    .img-layer { 
      position: absolute; 
      inset: 0; 
      width: 100%; 
      height: 100%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      opacity: 0; 
      transform: scale(0.95); 
      transition: opacity 0.3s ease, transform 0.3s ease; 
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

    .error-msg { 
      color: #ef4444 !important; 
      font-size: 15px; 
      padding: 18px; 
      overflow-y: auto; 
      max-height: 100%; 
      text-align: left; 
      background: rgba(239, 68, 68, 0.1); 
      border-radius: 10px; 
      border: 1px solid #fca5a5; 
      font-family: monospace; 
      white-space: pre-wrap; 
      word-break: break-all; 
    }

    .empty-msg { 
      font-size: 16px; 
      text-align: center; 
      color: var(--text-muted) !important; 
    }

    .caption { 
      margin-top: 18px; 
      font-size: 17px; 
      color: var(--primary-accent) !important; 
      font-weight: 600; 
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
      <div style="height: 4vh;"></div>
      ${textSectionsHTML}
      <div style="height: 20vh;"></div>
    </div>

    <div class="visual-column">
      <div class="controls">
        <select id="stepSelect">${selectOptionsHTML}</select>
        <button id="syncBtn">Sync</button>
      </div>

      <div class="img-wrapper">
        ${figureLayersHTML}
      </div>

      <div class="caption" id="figCaption">Figure 1 of ${totalSteps}</div>
    </div>
  </div>

  <script>
    (function() {
      function applyTheme(isDark) {
        var doc = document.documentElement;
        var body = document.body;

        if (isDark) {
          doc.classList.add('dark');
          doc.classList.remove('light');
          if (body) {
            body.classList.add('dark');
            body.classList.remove('light');
          }
        } else {
          doc.classList.add('light');
          doc.classList.remove('dark');
          if (body) {
            body.classList.add('light');
            body.classList.remove('dark');
          }
        }
      }

      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'THEME_CHANGE') {
          applyTheme(!!event.data.isDark);
        }
      });

      // Envia a altura real do conteúdo para o documento pai ajustar o iframe dinamicamente
      function sendHeight() {
        var bodyHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        try {
          window.parent.postMessage({ type: 'RESIZE_IFRAME', id: '${iframeId}', height: bodyHeight }, '*');
        } catch(e) {}
      }

      window.addEventListener('load', sendHeight);
      window.addEventListener('resize', sendHeight);
      setInterval(sendHeight, 800);

      try {
        window.parent.postMessage({ type: 'IFRAME_READY', id: '${iframeId}' }, '*');
      } catch(e) {}

      var textSteps = Array.from(document.querySelectorAll('.step-text'));
      var imgLayers = Array.from(document.querySelectorAll('.img-layer'));
      var select = document.getElementById('stepSelect');
      var syncBtn = document.getElementById('syncBtn');
      var caption = document.getElementById('figCaption');

      var activeIndex = 0;
      var isAutoScrolling = false;
      var scrollTimer;

      function updateState(index) {
        if (index < 0 || index >= imgLayers.length) return;
        activeIndex = index;

        if (select) select.value = index;
        if (caption) caption.textContent = 'Figure ' + (index + 1) + ' of ' + imgLayers.length;

        imgLayers.forEach(function(layer, idx) {
          if (idx === index) layer.classList.add('active');
          else layer.classList.remove('active');
        });

        textSteps.forEach(function(step, idx) {
          if (idx === index) {
            step.style.borderLeftColor = 'var(--primary-accent)';
            step.style.background = 'var(--step-bg-active)';
          } else {
            step.style.borderLeftColor = 'var(--border-color)';
            step.style.background = 'transparent';
          }
        });
        sendHeight();
      }

      window.addEventListener('scroll', function() {
        if (isAutoScrolling) return;

        var bestIndex = activeIndex;
        var minDistance = Infinity;
        var focalPoint = window.innerHeight * 0.4;

        textSteps.forEach(function(step, idx) {
          var rect = step.getBoundingClientRect();
          var distance = Math.abs((rect.top + rect.height / 2) - focalPoint);

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
          var targetIdx = parseInt(e.target.value, 10);
          updateState(targetIdx);
          isAutoScrolling = true;
          clearTimeout(scrollTimer);

          textSteps[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrollTimer = setTimeout(function() { isAutoScrolling = false; }, 800);
        });
      }

      if (syncBtn) {
        syncBtn.addEventListener('click', function() {
          updateState(activeIndex);
          textSteps[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      updateState(0);
      sendHeight();
    })();
  </script>
</body>
</html>`;

    const encodedBase64 = Buffer.from(rawHTMLContent).toString('base64');
    const dataUrl = `data:text/html;charset=utf-8;base64,${encodedBase64}`;

    return [
      {
        type: 'html',
        value: `
          <div style="
            width: 100%;
            max-width: 4100px;
            margin: 30px auto 10px auto;
            padding: 5px;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: stretch;
          ">
            <iframe
              id="${iframeId}"
              src="${dataUrl}"
              style="
                display: block;
                width: 100%;
                height: 1200px;
                border: 1px solid var(--myst-border, rgba(150, 150, 150, 0.2));
                border-radius: 20px;
                background: transparent;
              "
              frameborder="0">
            </iframe>
          </div>

          <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
               onload="(function(){
                 var iframeId = '${iframeId}';
                 
                 function applyMySTFix(targetHeight) {
                   var iframe = document.getElementById(iframeId);
                   if (!iframe) return false;

                   var hStr = targetHeight ? (targetHeight + 'px') : '1200px';

                   // 1. Neutraliza a div .relative.inline-block gerada pelo MyST e aplica altura exata
                   var mystWrapper = iframe.closest('.relative.inline-block');
                   if (mystWrapper) {
                     mystWrapper.style.setProperty('padding-bottom', '0px', 'important');
                     mystWrapper.style.setProperty('height', hStr, 'important');
                     mystWrapper.style.setProperty('min-height', hStr, 'important');
                     mystWrapper.style.setProperty('position', 'relative', 'important');
                     mystWrapper.style.setProperty('display', 'block', 'important');
                   }

                   // 2. Ajusta container intermédio do MyST (.leading-[0])
                   var containerBlock = iframe.closest('.leading-\\[0\\]');
                   if (containerBlock) {
                     containerBlock.style.setProperty('height', hStr, 'important');
                     containerBlock.style.setProperty('width', '100%', 'important');
                   }

                   // 3. Ajusta o iframe para acompanhar perfeitamente
                   iframe.style.setProperty('position', 'relative', 'important');
                   iframe.style.setProperty('height', hStr, 'important');
                   iframe.style.setProperty('width', '100%', 'important');

                   return true;
                 }

                 // Ouve mensagens de redimensionamento automáticas vindas do interior do iframe
                 window.addEventListener('message', function(event) {
                   if (event.data && event.data.type === 'RESIZE_IFRAME' && event.data.id === iframeId) {
                     applyMySTFix(event.data.height);
                   }
                   if (event.data && event.data.type === 'THEME_CHANGE') {
                     sendThemeToIframe();
                   }
                 });

                 if (!applyMySTFix()) {
                   var attempts = 0;
                   var interval = setInterval(function() {
                     attempts++;
                     if (applyMySTFix() || attempts > 40) {
                       clearInterval(interval);
                     }
                   }, 100);
                 }

                 function getParentDarkState() {
                   var htmlEl = document.documentElement;
                   var bodyEl = document.body;

                   var hasLight = htmlEl.classList.contains('light') || 
                                  htmlEl.getAttribute('data-theme') === 'light' ||
                                  htmlEl.getAttribute('theme') === 'light' ||
                                  (bodyEl && (bodyEl.classList.contains('light') || bodyEl.getAttribute('data-theme') === 'light'));

                   var hasDark = htmlEl.classList.contains('dark') || 
                                 htmlEl.getAttribute('data-theme') === 'dark' ||
                                 htmlEl.getAttribute('theme') === 'dark' ||
                                 (bodyEl && (bodyEl.classList.contains('dark') || bodyEl.getAttribute('data-theme') === 'dark'));

                   if (hasLight) return false;
                   if (hasDark) return true;

                   if (window.matchMedia) {
                     return window.matchMedia('(prefers-color-scheme: dark)').matches;
                   }

                   return false;
                 }

                 function sendThemeToIframe() {
                   var iframe = document.getElementById(iframeId);
                   if (iframe && iframe.contentWindow) {
                     var isDark = getParentDarkState();
                     iframe.contentWindow.postMessage({ 
                       type: 'THEME_CHANGE', 
                       isDark: isDark 
                     }, '*');
                   }
                 }

                 sendThemeToIframe();
                 var intervals = [100, 300, 600, 1200, 2500];
                 intervals.forEach(function(delay) {
                   setTimeout(sendThemeToIframe, delay);
                 });

                 try {
                   var observer = new MutationObserver(function() {
                     sendThemeToIframe();
                   });

                   observer.observe(document.documentElement, {
                     attributes: true,
                     attributeFilter: ['class', 'data-theme', 'theme']
                   });

                   if (document.body) {
                     observer.observe(document.body, {
                       attributes: true,
                       attributeFilter: ['class', 'data-theme', 'theme']
                     });
                   }
                 } catch(e) {}
               })()"
               style="display:none;" />
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