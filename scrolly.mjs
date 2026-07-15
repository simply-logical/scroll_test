export default {
  render({ model, el }) {

    const container = document.createElement('div');
    container.setAttribute('style', 'display: block; width: 100%; min-height: 400px; font-family: system-ui, sans-serif;');

    container.innerHTML = `
      <style>
        .scrolly-nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: fixed;
          right: 550px;
          top: 30%;
          transform: translateY(-50%);
          z-index:100;
          transition: right 0.3s ease;
        }
        @media (max-width: 1400px) {
          .scrolly-nav {
            right: 250px; /* Encosta o menu mais perto da borda direita da tela */
          }
        }  
        .nav-btn {
          padding: 10px 14px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          text-align: left;
          white-space: nowrap;
        }
        .nav-btn:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          transform: translateX(-5px); /* Move levemente para a esquerda ao passar o mouse */
        }
        .scrolly-wrapper {
          display: flex;
          gap: 20px;
          position: relative;
          background: #f8f9fa;
          padding: 20px;
          padding-bottom: 25vh;
          min-height: 100%;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .scrolly-text-side {
          flex: 1;
        }
        .scrolly-card {
          min-height: 300px;
          margin-bottom: 20px;
          padding: 15px;
          border-left: 4px solid #cbd5e1;
          background: #ffffff;
          transition: all 0.3s ease;
        }
        .scrolly-card.active-card {
          border-left-color: #3b82f6;
          background: rgba(59, 130, 246, 0.02);
          color: #1e293b;
        }
        .scrolly-visual-side {
          flex: 1;
          position: sticky;
          top: 200px;
          height: 250px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          align-self: flex-start;
        }
        .scrolly-stage {
          position: relative;
          width: 120px;
          height: 120px;
          }
        .widget-shape {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .widget-shape.show {
          opacity: 1;
          transform: scale(1);
          z-index: 5;
        }
      </style>

      <div class="scrolly-nav">
        <button class="nav-btn" data-target="1">Square</button>
        <button class="nav-btn" data-target="2">Triangle</button>
        <button class="nav-btn" data-target="3">Circle</button>
      </div>

      <div class="scrolly-wrapper" style="height: 175vh;">
        <div class="scrolly-text-side">
          <div class="scrolly-card active-card" data-idx="1">
            <h3>1. Square</h3>
            <p>This is my new paragraph.</p>
          </div>
          <div class="scrolly-card" data-idx="2">
            <h3>2. Triangle</h3>
            <p>3 sided polygon.</p>
          </div>
          <div class="scrolly-card" data-idx="3">
            <h3>3. Circle</h3>
            <p>A set of equidistant points.</p>
          </div>
        </div>

        <div class="scrolly-visual-side">
          <div class="scrolly-stage">
            <div class="widget-shape show" data-idx="1" style="background: #007bff;"></div>
            <div class="widget-shape" data-idx="2" style="background: #28a745; clip-path: polygon(50% 0%, 100% 100%, 0% 100%);"></div>
            <div class="widget-shape" data-idx="3" style="background: #dc3545; border-radius: 50%;"></div>
          </div>
        </div>
      </div>
    `;

    el.appendChild(container);

    const cards = container.querySelectorAll('.scrolly-card');
    const shapes = container.querySelectorAll('.widget-shape');
    
    const buttons = container.querySelectorAll('.nav-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetIdx = btn.getAttribute('data-target');
        const targetCard = container.querySelector(`.scrolly-card[data-idx="${targetIdx}"]`);
        
        if (targetCard) {
          targetCard.scrollIntoView({
            behavior: 'smooth', 
            block: 'center'    
          });
        }
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const targetIdx = entry.target.getAttribute('data-idx');

          cards.forEach(c => c.classList.remove('active-card'));
          entry.target.classList.add('active-card');

          shapes.forEach(s => {
            if (s.getAttribute('data-idx') === targetIdx) {
              s.classList.add('show');
            } else {
              s.classList.remove('show');
            }
          });
        }
      });
    }, {
      root: null,
      rootMargin: '-20% 0px -40% 0px',
      threshold: 0.2
    });

    cards.forEach(card => observer.observe(card));

    return () => {
      observer.disconnect();
    };
  }
};