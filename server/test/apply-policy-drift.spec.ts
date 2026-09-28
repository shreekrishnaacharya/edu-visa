// ---------------------------------------------------------------------------
// Approving an admission policy can move a band that courses already hold a
// copy of, so the two fall out of step the moment the policy is applied — the
// drift that had Newcastle courses advertising IELTS 6.0 while its own briefing
// said 6.5.
//
// The apply path therefore REPORTS that drift and never writes it. Writing here
// would be an unreviewed catalogue write triggered by a decision about a
// different entity, which is exactly what the staged-change model exists to
// prevent. These tests pin the three properties that matter: it stays a dry
// run, it stays quiet when no policy was applied, and a failure in the check
// never fails an apply that already succeeded.
// ---------------------------------------------------------------------------

import { SyncService } from '../src/modules/data-sync/sync.service';

function makeService(opts: {
  appliedPolicies: number;
  reconcile?: jest.Mock;
}) {
  const logged: { level: string; message: string }[] = [];
  const runs = {
    query: jest.fn(async (_sql: string, params: any[]) => {
      logged.push(JSON.parse(params[0])[0]);
    }),
    update: jest.fn(),
    findOne: jest.fn(),
  };
  const changes = { count: jest.fn().mockResolvedValue(opts.appliedPolicies) };
  const reconcile =
    opts.reconcile ??
    jest.fn().mockResolvedValue({ dry_run: true, updated: 7, skipped_stronger_source: 2, changes: [] });
  const consistency = { reconcileEntryFromPolicies: reconcile };

  const svc = new SyncService(
    {} as any, // queue
    runs as any,
    changes as any,
    {} as any, // source pages
    {} as any, // universities
    {} as any, // courses
    {} as any, // registry
    {} as any, // diff
    {} as any, // scraper
    consistency as any,
  );
  return { svc, logged, changes, reconcile };
}

const run: any = { id: '11111111-1111-4111-8111-111111111111', kind: 'cricos_register', log: [] };

describe('applyRun policy-drift reporting', () => {
  it('does not run the check when the apply touched no admission policy', async () => {
    const { svc, logged, reconcile } = makeService({ appliedPolicies: 0 });
    await (svc as any).reportPolicyDrift(run);

    expect(reconcile).not.toHaveBeenCalled();
    expect(logged).toHaveLength(0);
  });

  it('reports drift as a dry run and tells the reviewer to reconcile', async () => {
    const { svc, logged, reconcile } = makeService({ appliedPolicies: 3 });
    await (svc as any).reportPolicyDrift(run);

    // `true` is the dry-run flag: nothing may be written from the apply path.
    expect(reconcile).toHaveBeenCalledWith(true);
    expect(logged).toHaveLength(1);
    expect(logged[0].level).toBe('warn');
    expect(logged[0].message).toContain('3 policy change(s) applied');
    expect(logged[0].message).toContain('7 course band(s) now disagree');
    expect(logged[0].message).toContain('2 have stronger evidence');
    expect(logged[0].message).toContain('Nothing was written');
  });

  it('says so plainly when the policies and courses already agree', async () => {
    const { svc, logged } = makeService({
      appliedPolicies: 1,
      reconcile: jest.fn().mockResolvedValue({
        dry_run: true,
        updated: 0,
        skipped_stronger_source: 0,
        changes: [],
      }),
    });
    await (svc as any).reportPolicyDrift(run);

    expect(logged[0].level).toBe('info');
    expect(logged[0].message).toContain('are consistent with them');
  });

  it('never fails an apply that already succeeded', async () => {
    const { svc, logged } = makeService({
      appliedPolicies: 2,
      reconcile: jest.fn().mockRejectedValue(new Error('policy 4 has malformed academics')),
    });

    await expect((svc as any).reportPolicyDrift(run)).resolves.toBeUndefined();
    expect(logged[0].level).toBe('warn');
    expect(logged[0].message).toContain('Could not check policy/course consistency');
    expect(logged[0].message).toContain('malformed academics');
  });
});
