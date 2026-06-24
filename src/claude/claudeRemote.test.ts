import { describe, it, expect, vi } from 'vitest';
import { claudeRemote } from './claudeRemote';
import type { EnhancedMode } from './loop';

const { mockQuery } = vi.hoisted(() => ({
    mockQuery: vi.fn()
}));

vi.mock('@/claude/sdk', () => ({
    query: mockQuery,
    AbortError: class AbortError extends Error {}
}));

vi.mock('@/claude/utils/claudeCheckSession', () => ({
    claudeCheckSession: vi.fn(() => true)
}));

vi.mock('@/modules/watcher/awaitFileExist', () => ({
    awaitFileExist: vi.fn(async () => true)
}));

vi.mock('@/projectPath', () => ({
    projectPath: vi.fn(() => '/tmp/happy-cli-test')
}));

vi.mock('./utils/systemPrompt', () => ({
    systemPrompt: 'test-system-prompt'
}));

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
        debugLargeJson: vi.fn()
    }
}));

vi.mock('@/lib', () => ({
    logger: {
        debug: vi.fn(),
        debugLargeJson: vi.fn()
    }
}));

const mode: EnhancedMode = {
    permissionMode: 'default'
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

describe('claudeRemote streaming after result', () => {
    it('continues draining Claude output after result even while waiting for the next user message', async () => {
        const messagesSeen: string[] = [];
        const secondMessage = deferred<{ message: string, mode: EnhancedMode } | null>();
        let nextMessageCalls = 0;

        mockQuery.mockReturnValue((async function* () {
            yield { type: 'system', subtype: 'init', session_id: 'session-1' };
            yield { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'initial response' }] } };
            yield { type: 'result', subtype: 'success' };
            await sleep(5);
            yield { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'background task finished' }] } };
        })());

        const run = claudeRemote({
            sessionId: null,
            path: '/tmp',
            allowedTools: [],
            hookSettingsPath: '/tmp/settings.json',
            canCallTool: vi.fn(async () => ({ behavior: 'allow' } as any)),
            nextMessage: vi.fn(async () => {
                nextMessageCalls += 1;
                if (nextMessageCalls === 1) {
                    return { message: 'start task', mode };
                }
                return secondMessage.promise;
            }),
            onReady: vi.fn(),
            isAborted: vi.fn(() => false),
            onSessionFound: vi.fn(),
            onThinkingChange: vi.fn(),
            onMessage: (message: any) => {
                if (message.type === 'assistant') {
                    const text = message.message.content
                        .filter((block: any) => block.type === 'text')
                        .map((block: any) => block.text)
                        .join('\n');
                    messagesSeen.push(text);
                }
            }
        });

        try {
            await sleep(30);
            expect(messagesSeen).toContain('initial response');
            expect(messagesSeen).toContain('background task finished');
        } finally {
            secondMessage.resolve(null);
            await run;
        }
    });

    it('surfaces nextMessage errors without poisoning the prompt stream', async () => {
        const expectedError = new Error('queue failed');
        let nextMessageCalls = 0;

        mockQuery.mockReturnValue((async function* () {
            yield { type: 'system', subtype: 'init', session_id: 'session-1' };
            yield { type: 'result', subtype: 'success' };
            await sleep(10);
        })());

        await expect(claudeRemote({
            sessionId: null,
            path: '/tmp',
            allowedTools: [],
            hookSettingsPath: '/tmp/settings.json',
            canCallTool: vi.fn(async () => ({ behavior: 'allow' } as any)),
            nextMessage: vi.fn(async () => {
                nextMessageCalls += 1;
                if (nextMessageCalls === 1) {
                    return { message: 'start task', mode };
                }
                throw expectedError;
            }),
            onReady: vi.fn(),
            isAborted: vi.fn(() => false),
            onSessionFound: vi.fn(),
            onThinkingChange: vi.fn(),
            onMessage: vi.fn()
        })).rejects.toThrow('queue failed');
    });

    it('aborts an in-flight nextMessage wait when the Claude response stream ends', async () => {
        let nextMessageCalls = 0;
        let waitSignal: AbortSignal | undefined;
        const secondMessage = deferred<{ message: string, mode: EnhancedMode } | null>();

        mockQuery.mockReturnValue((async function* () {
            yield { type: 'system', subtype: 'init', session_id: 'session-1' };
            yield { type: 'result', subtype: 'success' };
        })());

        await claudeRemote({
            sessionId: null,
            path: '/tmp',
            allowedTools: [],
            hookSettingsPath: '/tmp/settings.json',
            canCallTool: vi.fn(async () => ({ behavior: 'allow' } as any)),
            nextMessage: vi.fn(async (abortSignal?: AbortSignal) => {
                nextMessageCalls += 1;
                if (nextMessageCalls === 1) {
                    return { message: 'start task', mode };
                }
                waitSignal = abortSignal;
                return secondMessage.promise;
            }),
            onReady: vi.fn(),
            isAborted: vi.fn(() => false),
            onSessionFound: vi.fn(),
            onThinkingChange: vi.fn(),
            onMessage: vi.fn()
        });

        expect(waitSignal?.aborted).toBe(true);
        secondMessage.resolve({ message: 'stale message', mode });
    });
});
