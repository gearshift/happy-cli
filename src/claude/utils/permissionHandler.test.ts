import { describe, expect, it, vi } from 'vitest';
import { PermissionHandler } from './permissionHandler';
import type { PermissionResult } from '../sdk/types';
import type { Session } from '../session';

interface FakeAgentState {
    requests: Record<string, { tool: string; arguments: unknown; createdAt: number }>;
    completedRequests: Record<string, unknown>;
}

interface PermissionResponse {
    id: string;
    approved: boolean;
    reason?: string;
    mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    allowTools?: string[];
}

function createFakeSession() {
    let permissionHandler: ((message: PermissionResponse) => Promise<void>) | undefined;
    let state: FakeAgentState = {
        requests: {},
        completedRequests: {}
    };

    const session = {
        api: {
            push: () => ({
                sendToAllDevices: vi.fn()
            })
        },
        client: {
            sessionId: 'session-1',
            rpcHandlerManager: {
                registerHandler: vi.fn((method: string, handler: (message: PermissionResponse) => Promise<void>) => {
                    if (method === 'permission') {
                        permissionHandler = handler;
                    }
                })
            },
            updateAgentState: vi.fn((updater: (currentState: FakeAgentState) => FakeAgentState) => {
                state = updater(state);
            })
        },
        queue: {
            unshift: vi.fn()
        }
    } as unknown as Session;

    return {
        session,
        getState: () => state,
        respondToPermission: async (response: PermissionResponse) => {
            if (!permissionHandler) {
                throw new Error('permission handler was not registered');
            }
            await permissionHandler(response);
        }
    };
}

describe('PermissionHandler', () => {
    it('uses the SDK-provided toolUseID for permission requests before assistant tool messages are observed', async () => {
        const { session, getState, respondToPermission } = createFakeSession();
        const handler = new PermissionHandler(session);
        const abortController = new AbortController();

        const resultPromise = handler.handleToolCall(
            'Bash',
            { command: 'ls -la /tmp', description: 'List temp directory' },
            { permissionMode: 'default' },
            { signal: abortController.signal, toolUseID: 'toolu_direct_from_sdk' }
        );

        expect(getState().requests).toHaveProperty('toolu_direct_from_sdk');
        expect(getState().requests.toolu_direct_from_sdk.tool).toBe('Bash');

        await respondToPermission({
            id: 'toolu_direct_from_sdk',
            approved: true
        });

        await expect(resultPromise).resolves.toEqual({
            behavior: 'allow',
            updatedInput: { command: 'ls -la /tmp', description: 'List temp directory' }
        } satisfies PermissionResult);
    });
});
