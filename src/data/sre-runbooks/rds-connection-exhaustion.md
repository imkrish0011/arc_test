# RDS Connection Exhaustion & Capacity Bottleneck

## Metadata
- **Scenario**: rds_bottleneck
- **Target Service**: AWS RDS (Aurora PostgreSQL / MySQL)
- **Fix Intent**: UPGRADE_RDS_INSTANCE | ATTACH_RDS_PROXY

## Error Signatures & Patterns
- `FATAL: remaining connection slots are reserved for non-replication superuser connections`
- `SequelizeConnectionAcquireTimeoutError: Operation timeout`
- `Connection pool saturation at 90%`
- `Too many connections`
- `max_connections` exceeded

## Common Root Causes
1. Application connection leak or missing connection pooling proxy (RDS Proxy).
2. Recent parameter group modification lowering `max_connections`.
3. Database instance size undersized for current read/write concurrent traffic.
4. Slow/unindexed queries holding connection slots open for extended periods.

## Diagnostic Verification Steps
1. Correlate with CloudTrail `ModifyDBParameterGroup` or `RebootDBInstance` within last 60 minutes.
2. Check `CPUUtilization` (> 90%) and `DatabaseConnections` metrics.
3. Validate upstream Lambda/API Gateway latency and 504 errors caused by stalled database transactions.

## Recommended Remediation
- Primary: Attach RDS Proxy or increase instance class to scale memory-driven `max_connections`.
- Immediate: Scale up instance type or adjust connection pool settings.

