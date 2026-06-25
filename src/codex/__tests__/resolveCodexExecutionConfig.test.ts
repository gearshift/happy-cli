import { describe, expect, it } from 'vitest';
import { resolveCodexExecutionConfig } from '../runCodex';

describe('resolveCodexExecutionConfig', () => {
    it('uses non-interactive Codex approvals for yolo so MCP calls do not wedge behind hidden approvals', () => {
        expect(resolveCodexExecutionConfig('yolo')).toEqual({
            approvalPolicy: 'never',
            sandbox: 'danger-full-access',
        });
        expect(resolveCodexExecutionConfig('bypassPermissions')).toEqual({
            approvalPolicy: 'never',
            sandbox: 'danger-full-access',
        });
    });

    it('uses non-interactive Codex approvals for safe-yolo and read-only modes', () => {
        expect(resolveCodexExecutionConfig('safe-yolo')).toEqual({
            approvalPolicy: 'never',
            sandbox: 'workspace-write',
        });
        expect(resolveCodexExecutionConfig('read-only')).toEqual({
            approvalPolicy: 'never',
            sandbox: 'read-only',
        });
    });

    it('keeps conservative approval behavior for default, accept edits, and plan modes', () => {
        expect(resolveCodexExecutionConfig('default')).toEqual({
            approvalPolicy: 'untrusted',
            sandbox: 'workspace-write',
        });
        expect(resolveCodexExecutionConfig('acceptEdits')).toEqual({
            approvalPolicy: 'on-request',
            sandbox: 'workspace-write',
        });
        expect(resolveCodexExecutionConfig('plan')).toEqual({
            approvalPolicy: 'untrusted',
            sandbox: 'workspace-write',
        });
    });
});
