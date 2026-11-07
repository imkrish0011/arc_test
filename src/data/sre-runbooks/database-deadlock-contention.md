# Database Row Deadlock and Lock Contention Storm

## Metadata
- **Scenario**: database_deadlock_contention
- **Target Service**: AWS RDS Aurora PostgreSQL & SQS
- **Fix Intent**: RESOLVE_DATABASE_DEADLOCK_CONTENTION

## Error Signatures & Patterns
- `ERROR: deadlock detected`
- `waits for ExclusiveLock on tuple`
- `pg_stat_activity: 488 of 500 sessions waiting in state`
- `deadlock detected. Process`
- `Lock:tuple`
- `query timed out after 30000ms while acquiring row lock`
- `Deadlocks`

## Common Root Causes
1. Concurrent parallel transactions updating identical database rows in differing topological orders.
2. Unbounded `lock_timeout` (0) allowing transactions to hold exclusive locks indefinitely, starving connection pools.
3. Lack of an asynchronous FIFO serialization queue to batch and order high-contention writes per resource partition.
4. Attempting to vertically scale RDS hardware, which fails to fix algorithmic lock ordering deadlocks.

## Diagnostic Verification Steps
1. Correlate CloudWatch `Deadlocks` metric spike (> 1) with application transaction timeouts.
2. Verify `pg_stat_activity` indicates high connection counts stuck in `exclusive lock` or `tuple lock` state with low CPU.
3. Correlate with CloudTrail `ModifyDBParameterGroup` removing lock timeouts.

## Recommended Remediation
- Primary: Set `lock_timeout = '2000ms'` in RDS DB parameter group so transactions fail fast and release locked buffers.
- Secondary: Provision SQS FIFO queue with partition key deduplication to serialize hot-row mutations.
- Tertiary: Enforce deterministic alphabetical row locking order in application SQL transactions.
