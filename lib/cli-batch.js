'use strict';
// Pure helpers for `node proxy.js --model <name> "<prompt>"` one-shot CLI batch
// mode. Kept separate from proxy.js so the parsing/formatting logic is
// unit-testable without spawning a real process or provider.

const HELP_TEXT = `Local LLM Hub — CLI batch mode

Usage:
  llm-hub --model <name> "<prompt>"
  echo "<prompt>" | llm-hub --model <name>

Options:
  --model <name>        Model to use (required, e.g. llama3.2)
  --provider <name>     "ollama" (default) or "lmstudio"
  --system <text>       System prompt
  --temperature <n>     Sampling temperature
  --prompt <text>       Prompt text (alternative to positional arg / stdin)
  --json                Print the raw provider JSON response instead of just the text
  -h, --help            Show this help

If no prompt is given as an argument or --prompt, it is read from stdin.
With no --model, the normal web server starts instead.`;

function parseCliArgs(argv) {
  const args = {
    batchMode: false,
    provider: 'ollama',
    model: null,
    system: null,
    temperature: null,
    json: false,
    prompt: null,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--model':       args.model = argv[++i] ?? null; break;
      case '--provider':    args.provider = argv[++i] ?? args.provider; break;
      case '--system':      args.system = argv[++i] ?? null; break;
      case '--temperature': args.temperature = parseFloat(argv[++i]); break;
      case '--prompt':       args.prompt = argv[++i] ?? null; break;
      case '--json':          args.json = true; break;
      case '-h':
      case '--help':          args.help = true; break;
      default:
        if (!a.startsWith('-')) positional.push(a);
    }
  }

  if (args.prompt == null && positional.length) args.prompt = positional.join(' ');
  if (args.temperature != null && Number.isNaN(args.temperature)) args.temperature = null;
  args.batchMode = args.help || args.model != null;
  return args;
}

function buildBatchMessages({ system, prompt }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function extractAssistantText(responseData) {
  const content = responseData?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.length) return content;
  const err = responseData?.error;
  if (err) return typeof err === 'string' ? err : (err.message || JSON.stringify(err));
  return '';
}

module.exports = { HELP_TEXT, parseCliArgs, buildBatchMessages, extractAssistantText };
