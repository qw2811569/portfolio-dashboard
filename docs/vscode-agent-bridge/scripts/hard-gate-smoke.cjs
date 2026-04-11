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

const { requireCompletionEvidence, requireConsensusApproved } = require('../out/extension.js');
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

const noConsensusResult = requireConsensusApproved({
  requiresConsensus: true,
  consensusState: 'none',
});

assert(noConsensusResult.ok === false, 'missing consensus approval should fail');
assert(noConsensusResult.reason === 'none', `unexpected consensus reason: ${JSON.stringify(noConsensusResult)}`);

const approvedConsensusResult = requireConsensusApproved({
  requiresConsensus: true,
  consensusState: 'approved',
});

assert(approvedConsensusResult.ok === true, 'approved consensus should pass');

const notRequiredConsensusResult = requireConsensusApproved({
  requiresConsensus: false,
  consensusState: 'pending',
});

assert(notRequiredConsensusResult.ok === true, 'consensus gate should skip tasks that do not require consensus');

console.log('hard-gate smoke: ok');
