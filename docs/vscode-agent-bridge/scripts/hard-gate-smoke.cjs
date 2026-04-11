const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') {
    return {
      window: {},
      workspace: {},
      StatusBarAlignment: { Right: 0 },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { requireCompletionEvidence } = require('../out/extension.js');
Module._load = originalLoad;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const emptyResult = requireCompletionEvidence({
  evidence: {
    changedFiles: [],
    verificationRuns: [],
    risksNoted: [],
    nextStep: '',
  },
});

assert(emptyResult.ok === false, 'empty evidence should fail');
assert(
  JSON.stringify(emptyResult.missing) ===
    JSON.stringify(['changedFiles', 'verificationRuns', 'risksNoted', 'nextStep']),
  `unexpected missing fields: ${JSON.stringify(emptyResult)}`
);

const fullResult = requireCompletionEvidence({
  evidence: {
    changedFiles: ['docs/vscode-agent-bridge/src/extension.ts'],
    verificationRuns: ['npm run compile'],
    risksNoted: ['no additional risks'],
    nextStep: 'Enable AGENT_BRIDGE_HARD_GATES=1 after manual verification.',
  },
});

assert(fullResult.ok === true, 'full evidence should pass');
console.log('hard-gate smoke: ok');
