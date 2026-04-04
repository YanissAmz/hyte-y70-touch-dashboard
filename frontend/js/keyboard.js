// On-screen virtual keyboard
(function() {
  let activeInput = null;
  let kbd = null;
  let shifted = false;

  const ROWS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['SHIFT','z','x','c','v','b','n','m','DEL'],
    ['.com','@','SPACE','/','GO']
  ];

  function createKeyboard() {
    kbd = document.createElement('div');
    kbd.id = 'virtual-keyboard';
    kbd.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:500;' +
      'background:rgba(13,15,20,0.97);' +
      'border-top:1px solid rgba(255,255,255,0.08);' +
      'padding:16px 12px;display:none;flex-direction:column;gap:10px';

    ROWS.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.style.cssText = 'display:flex;gap:8px;justify-content:center';
      row.forEach(key => {
        const btn = document.createElement('button');
        btn.dataset.key = key;
        let label = key;
        let flex = '1';
        let maxW = '90px';

        if (key === 'SPACE') { label = ''; flex = '4'; maxW = '400px'; }
        else if (key === 'SHIFT') { label = '⇧'; flex = '1.5'; maxW = '120px'; }
        else if (key === 'DEL') { label = '⌫'; flex = '1.5'; maxW = '120px'; }
        else if (key === 'GO') { label = '→'; flex = '1.5'; maxW = '120px'; }
        else if (key === '.com') { flex = '1.5'; maxW = '120px'; }

        btn.textContent = label;
        btn.style.cssText = 'flex:' + flex + ';max-width:' + maxW + ';height:64px;' +
          'border-radius:12px;border:1px solid rgba(255,255,255,0.08);' +
          'background:rgba(255,255,255,0.08);color:#E6EDF3;' +
          'font-size:24px;font-family:inherit;cursor:pointer;' +
          'display:flex;align-items:center;justify-content:center;' +
          'transition:background 0.1s';

        btn.addEventListener('touchend', e => {
          e.preventDefault();
          e.stopPropagation();
          onKey(key);
        });
        btn.addEventListener('click', e => {
          e.stopPropagation();
          onKey(key);
        });
        rowDiv.appendChild(btn);
      });
      kbd.appendChild(rowDiv);
    });

    document.body.appendChild(kbd);
  }

  function onKey(key) {
    if (!activeInput) return;
    if (key === 'DEL') {
      const pos = activeInput.selectionStart;
      if (pos > 0) {
        activeInput.value = activeInput.value.slice(0, pos - 1) + activeInput.value.slice(pos);
        activeInput.setSelectionRange(pos - 1, pos - 1);
      }
    } else if (key === 'SHIFT') {
      shifted = !shifted;
      updateShift();
    } else if (key === 'SPACE') {
      insertText(' ');
    } else if (key === 'GO') {
      activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      hide();
    } else if (key === '.com') {
      insertText('.com');
    } else {
      const ch = shifted ? key.toUpperCase() : key;
      insertText(ch);
      if (shifted) { shifted = false; updateShift(); }
    }
  }

  function insertText(text) {
    const pos = activeInput.selectionStart;
    const end = activeInput.selectionEnd;
    activeInput.value = activeInput.value.slice(0, pos) + text + activeInput.value.slice(end);
    const newPos = pos + text.length;
    activeInput.setSelectionRange(newPos, newPos);
  }

  function updateShift() {
    if (!kbd) return;
    kbd.querySelectorAll('button').forEach(btn => {
      const k = btn.dataset.key;
      if (k && k.length === 1) {
        btn.textContent = shifted ? k.toUpperCase() : k;
      }
      if (k === 'SHIFT') {
        btn.style.background = shifted ? 'rgba(88,166,255,0.3)' : 'rgba(255,255,255,0.08)';
      }
    });
  }

  function show(input) {
    activeInput = input;
    if (!kbd) createKeyboard();
    kbd.style.display = 'flex';
  }

  function hide() {
    if (kbd) kbd.style.display = 'none';
    activeInput = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Show keyboard on input focus
    document.addEventListener('focusin', e => {
      if (e.target.tagName === 'INPUT' && (e.target.type === 'url' || e.target.type === 'text' || e.target.type === 'password' || e.target.type === 'search')) {
        show(e.target);
      }
    });

    // Hide on tap outside keyboard, input, and modal
    document.addEventListener('touchstart', e => {
      if (!kbd || kbd.style.display === 'none') return;
      if (kbd.contains(e.target)) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Ne pas cacher si on est dans un modal
      if (e.target.closest && e.target.closest('.modal-overlay, .modal')) return;
      hide();
    }, { passive: true });
  });
})();
