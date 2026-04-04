/**
 * Page 7 — Ollama Chat
 * Streaming chat interface avec les modèles LLM locaux via l'API Ollama.
 */

const ollamaState = {
  model: '',
  messages: [],     // {role:'user'|'assistant', content:string}[]
  streaming: false,
  currentReader: null,
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function ollamaInit() {
  await ollamaLoadModels();

  const input  = document.getElementById('ollama-input');
  const sendBtn = document.getElementById('ollama-send');
  const clearBtn = document.getElementById('ollama-clear');
  const select = document.getElementById('ollama-model-select');

  sendBtn.addEventListener('click', ollamaSend);
  clearBtn.addEventListener('click', ollamaClear);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ollamaSend(); }
  });

  select.addEventListener('change', () => {
    ollamaState.model = select.value;
  });

  // Keyboard.js auto-activates on focus — nothing special needed
}

// ── Charger les modèles ───────────────────────────────────────────────────────

async function ollamaLoadModels() {
  const select = document.getElementById('ollama-model-select');
  try {
    const resp = await fetch('/api/ollama/models');
    const data = await resp.json();
    const models = data.models || [];

    select.innerHTML = '';
    if (models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Aucun modèle';
      select.appendChild(opt);
      ollamaState.model = '';
      return;
    }

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });

    // Prefer llama3 / llama3.2 if available
    const preferred = models.find(m => m.startsWith('llama3')) || models[0];
    select.value = preferred;
    ollamaState.model = preferred;
  } catch {
    select.innerHTML = '<option value="">Ollama offline</option>';
    ollamaState.model = '';
  }
}

// ── Envoyer un message ────────────────────────────────────────────────────────

async function ollamaSend() {
  if (ollamaState.streaming) return;

  const input = document.getElementById('ollama-input');
  const text = input.value.trim();
  if (!text) return;
  if (!ollamaState.model) {
    ollamaShowError('Aucun modèle sélectionné');
    return;
  }

  input.value = '';

  // Ajouter le message utilisateur
  ollamaState.messages.push({ role: 'user', content: text });
  ollamaRenderMessage({ role: 'user', content: text });
  ollamaScrollBottom();

  // Préparer la bulle assistant (streaming)
  ollamaState.streaming = true;
  const bubble = ollamaCreateBubble('assistant');
  ollamaScrollBottom();

  let fullContent = '';

  try {
    const resp = await fetch('/api/ollama/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaState.model,
        messages: ollamaState.messages,
      }),
    });

    const reader = resp.body.getReader();
    ollamaState.currentReader = reader;
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // garde le dernier fragment incomplet

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim());
          if (chunk.error) {
            ollamaUpdateBubble(bubble, `Erreur : ${chunk.error}`);
            fullContent = chunk.error;
            break;
          }
          fullContent += chunk.content || '';
          ollamaUpdateBubble(bubble, fullContent);
          ollamaScrollBottom();
          if (chunk.done) break;
        } catch { /* ligne incomplète */ }
      }
    }
  } catch (e) {
    ollamaUpdateBubble(bubble, `Erreur réseau : ${e.message}`);
    fullContent = e.message;
  }

  // Sauvegarder la réponse dans l'historique
  ollamaState.messages.push({ role: 'assistant', content: fullContent });
  ollamaState.streaming = false;
  ollamaState.currentReader = null;
  ollamaScrollBottom();
}

// ── Rendu ─────────────────────────────────────────────────────────────────────

function ollamaRenderMessage({ role, content }) {
  const msgs = document.getElementById('ollama-messages');

  // Supprimer le welcome screen si présent
  const welcome = msgs.querySelector('.ollama-welcome');
  if (welcome) welcome.remove();

  const wrap = document.createElement('div');
  wrap.className = `ollama-msg-wrap ollama-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'ollama-bubble';
  bubble.textContent = content;

  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  return wrap;
}

function ollamaCreateBubble(role) {
  const msgs = document.getElementById('ollama-messages');

  const welcome = msgs.querySelector('.ollama-welcome');
  if (welcome) welcome.remove();

  const wrap = document.createElement('div');
  wrap.className = `ollama-msg-wrap ollama-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'ollama-bubble ollama-streaming';
  bubble.innerHTML = '<span class="ollama-cursor">▋</span>';

  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  return bubble;
}

function ollamaUpdateBubble(bubble, content) {
  // Markdown basique : gras, italique, code inline, blocs code
  bubble.classList.remove('ollama-streaming');
  bubble.innerHTML = ollamaMarkdown(content) + (ollamaState.streaming ? '<span class="ollama-cursor">▋</span>' : '');
}

function ollamaMarkdown(text) {
  // Blocs de code ```
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="ollama-code">${escapeHtml(code.trim())}</pre>`
  );
  // Code inline `
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code class="ollama-inline-code">${escapeHtml(c)}</code>`);
  // Gras **
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italique *
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Sauts de ligne
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ollamaScrollBottom() {
  const msgs = document.getElementById('ollama-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

function ollamaClear() {
  ollamaState.messages = [];
  if (ollamaState.currentReader) {
    ollamaState.currentReader.cancel();
    ollamaState.streaming = false;
    ollamaState.currentReader = null;
  }
  const msgs = document.getElementById('ollama-messages');
  msgs.innerHTML = `
    <div class="ollama-welcome">
      <div class="ollama-welcome-icon">&#x1F916;</div>
      <div class="ollama-welcome-text">Prêt à discuter</div>
    </div>`;
}

function ollamaShowError(msg) {
  const msgs = document.getElementById('ollama-messages');
  const err = document.createElement('div');
  err.className = 'ollama-error';
  err.textContent = msg;
  msgs.appendChild(err);
  ollamaScrollBottom();
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  ollamaInit();
});
