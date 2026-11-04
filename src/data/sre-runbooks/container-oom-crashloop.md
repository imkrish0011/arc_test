# ECS/EKS Container OOM CrashLoopBackOff

## Metadata
- **Scenario**: container_crashloop
- **Target Service**: AWS ECS (Fargate/EC2) & EKS
- **Fix Intent**: INCREASE_CONTAINER_MEMORY | ROLLBACK_TASK

## Error Signatures & Patterns
- `Exit Code 137 (OutOfMemoryError)`
- `JavaScript heap out of memory`
- `allocation failure; JavaScript heap out of memory`
- `CrashLoopBackOff`
- `Essential container in task exited with Exit Code 137`
- `Process terminated by Linux kernel OOM-killer`

## Common Root Causes
1. Container memory limit configured too low in ECS Task Definition / Kubernetes pod spec.
2. Recent deployment/update reducing container memory reservation.
3. Memory leak in application runtime (e.g. uncollected heap buffers, unbounded cache).
4. Sudden burst in request payload size causing momentary memory spikes.

## Diagnostic Verification Steps
1. Correlate with CloudTrail `RegisterTaskDefinition` or `UpdateService` mutating `memory` values.
2. Check ECS `ContainerCrashCount` or Task Stop count (> 3 in 10 mins).
3. Check ALB `UnHealthyHostCount` spikes triggered by stopped containers failing health checks.

## Recommended Remediation
- Primary: Increase container memory limit (e.g., 512MB -> 1024MB/2048MB).
- Alternate: Roll back task definition to previous healthy revision.

