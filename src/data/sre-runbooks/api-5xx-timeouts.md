# API 5xx Cascading Latency & Lambda Function Timeouts

## Metadata
- **Scenario**: api_5xx_timeouts
- **Target Service**: AWS API Gateway, ALB, AWS Lambda
- **Fix Intent**: INCREASE_LAMBDA_TIMEOUT | RAISE_ASG_MAX_CAPACITY

## Error Signatures & Patterns
- `Task timed out after`
- `Gateway Timeout (504)`
- `HTTP 504 Gateway Timeout`
- `5XXError` threshold crossed
- `TargetResponseTime` exceeded (> 3000ms)
- `ConcurrentExecutions` saturated

## Common Root Causes
1. Lambda function execution timeout threshold set too low for high load or cold starts.
2. Auto Scaling Group `maxCapacity` capped too low to absorb incoming traffic spikes.
3. Downstream dependency bottleneck (database or 3rd-party API) causing target threads to stall.

## Diagnostic Verification Steps
1. Correlate with CloudTrail `PutScalingPolicy` capping ASG max capacity or Lambda config updates.
2. Check CloudWatch metric `5XXError` (> 5%) and `TargetResponseTime` (> 3000ms).
3. Search Lambda execution logs for exact timeout duration lines.

## Recommended Remediation
- Primary: Increase Lambda function timeout configuration (e.g. 3s -> 15s/30s).
- Alternate: Raise Auto Scaling Group max capacity or increase Lambda provisioned concurrency.

