import fs from 'fs';
import path from 'path';

function renderNodesToHTML(nodes) {
  if (!nodes) return '';
  if (typeof nodes === 'string') return nodes;
  if (Array.isArray(nodes)) return nodes.map(renderNodesToHTML).join('');
  if (nodes.type === 'text') return nodes.value || '';
  if (nodes.value) return nodes.value;

  const tag = nodes.name || nodes.hName || 'span';
  const childrenHTML = nodes.children ? renderNodesToHTML(nodes.children) : '';

  if (tag === 'paragraph' || tag === 'p') {
    return `<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify; font-size: 15px; color: #1e293b; font-family: sans-serif;">${childrenHTML}</p>`;
  }

  return `<${tag}>${childrenHTML}</${tag}>`;
}


function extractStepBlocks(body) {
  if (!body) return [];
  const bodyArray = Array.isArray(body) ? body : [body];
  let extracted = [];

  bodyArray.forEach(node => {
    if (node.children && Array.isArray(node.children) && (node.type === 'root' || node.type === 'block' || !node.type)) {
      node.children.forEach(child => {
        if (child.type === 'paragraph' || child.type === 'p' || child.type === 'list') {
          extracted.push(child);
        }
      });
    } else {
      extracted.push(node);
    }
  });

  return extracted.filter(Boolean);
}

function getLocalImageAsBase64(filePath) {
  try {
    if (!filePath) return '';
    const cleanPath = filePath.trim().replace(/^['"]|['"]$/g, '');
    const absolutePath = path.isAbsolute(cleanPath) 
      ? cleanPath 
      : path.resolve(process.cwd(), cleanPath);

    if (!fs.existsSync(absolutePath)) {
      console.warn(`[Scrollytelling] Arquivo não encontrado: ${absolutePath}`);
      return '';
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    
    let mimeType = 'image/png';
    if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';

    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    console.error(`[Scrollytelling] Erro ao ler imagem local: ${filePath}`, error);
    return '';
  }
}

export const scrollytellingImagesDirective = {
  name: 'scrollytelling-images',
  alias: ['scrollytellingImages', 'scrollytelling-image'],
  options: {
    title: { type: String },
    images: { type: String },
    imgWidth: { type: String },
  },
  body: {
    type: 'myst',
  },
  run(data) {
    const title = data.options?.title ?? 'Scrollytelling Interativo';
    const width = data.options?.imgWidth ?? '350px';

    const rawImages = data.options?.images ?? '';
    const imagePaths = rawImages.split(',').map(img => img.trim()).filter(Boolean);
    const extractedBlocks = extractStepBlocks(data.body);

    const totalSteps = Math.max(imagePaths.length, extractedBlocks.length, 1);
    const base64Images = imagePaths.map(imgPath => getLocalImageAsBase64(imgPath));

    // Left card content
    const textSectionsHTML = Array.from({ length: totalSteps }).map((_, index) => {
      const stepIndex = index + 1;
      const blockNode = extractedBlocks[index];
      const blockHTML = blockNode ? renderNodesToHTML(blockNode) : '';

      return `
        <div class="step-text" data-index="${index}" style="min-height: 70vh; margin-bottom: 10vh; display: flex; flex-direction: column; justify-content: center; border-left: 4px solid #cbd5e1; padding-left: 20px; transition: all 0.3s ease;">
          <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 8px;">
            Step ${stepIndex} of ${totalSteps}
          </div>
          <div style="color: #334155; font-size: 15px; line-height: 1.6;">
            ${blockHTML}
          </div>
        </div>
      `;
    }).join('');

    // Select option
    const selectOptionsHTML = Array.from({ length: totalSteps }).map((_, index) => {
      return `<option value="${index}">${index + 1}. Figure ${index + 1}</option>`;
    }).join('');

    // Stacked images
    const figureLayersHTML = Array.from({ length: totalSteps }).map((_, index) => {
      const b64 = base64Images[index] || '';
      return `
        <div class="img-layer ${index === 0 ? 'active' : ''}" data-index="${index}">
          ${b64 
            ? `<img src="${b64}" alt="Figure ${index + 1}" />` 
            : `<div style="color:#ef4444; font-size:12px; text-align:center;">Image not found</div>`}
        </div>
      `;
    }).join('');

    // Html document
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

          .container { display: flex; gap: 48px; max-width: 1100px; margin: 0 auto; padding: 32px 24px; position: relative; }
          .text-column { flex: 1; min-width: 0; }
          
          .visual-column { 
            flex: 0 0 ${width}; 
            width: ${width}; 
            position: sticky; 
            top: 20px; 
            height: 360px; 
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

          .img-wrapper { position: relative; width: 100%; height: 230px; overflow: hidden; }
          
          /* TRANSITION RULE VIA PURE CSS */
          .img-layer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: scale(0.85);
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

          .caption { margin-top: 10px; font-size: 13px; color: #2563eb; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>${title}</h3>
          <span>Scrollytelling</span>
        </div>

        <div class="container">
          <div class="text-column">
            <div style="height: 5vh;"></div>
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

              // Troca de classes nativas no DOM isolado
              imgLayers.forEach((layer, idx) => {
                if (idx === index) {
                  layer.classList.add('active');
                } else {
                  layer.classList.remove('active');
                }
              });

              textSteps.forEach((step, idx) => {
                if (idx === index) {
                  step.style.borderLeftColor = '#2563eb';
                  step.style.background = 'rgba(37, 99, 235, 0.05)';
                } else {
                  step.style.borderLeftColor = '#cbd5e1';
                  step.style.background = 'transparent';
                }
              });
            }

            // Escutador de Scroll NATIVO (Garantido sem bloqueio)
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

              if (bestIndex !== activeIndex) {
                updateState(bestIndex);
              }
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
          width: min(50vw, 700px);
          height: clamp(900px, 150vh, 3500px);
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
  name: 'MyST Scrollytelling Images Base64 Iframe Plugin', 
  directives: [scrollytellingImagesDirective] 
};

export default plugin;