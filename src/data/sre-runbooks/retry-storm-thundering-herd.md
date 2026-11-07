# Cascading Retry Storm and Thundering Herd Remediation

## Metadata
- **Scenario**: retry_storm_thundering_herd
- **Target Service**: AWS ECS, Envoy Ingress & ElastiCache
- **Fix Intent**: CONFIGURE_CIRCUIT_BREAKER_AND_JITTER

## Error Signatures & Patterns
- `upstream HTTP 429 Too Many Requests`
- `envoy.circuit_breaker: connection pool overflow`
- `retry_storm_detected: concurrent retry amplification factor`
- `ThrottledRequests`
- `max_pending_requests`
- `Circuit open required`
- `AGGRESSIVE_FIXED_50MS`

## Common Root Causes
1. Downstream services configured with aggressive tight retries without exponential backoff and jitter.
2. Temporary transient upstream delay amplified into an overwhelming thundering herd by client retry storms.
3. Lack of Envoy/Istio circuit breaker tripping to protect degraded dependencies from being crushed.
4. Naive horizontal scaling attempts that multiply the number of callers slamming the throttled endpoint.

## Diagnostic Verification Steps
1. Correlate CloudWatch `ThrottledRequests` and downstream `5XXError` spike.
2. Inspect log lines for retry multiplier factor (`amplification factor > 5x`).
3. Check CloudTrail for recent deployment altering client retry configuration without jitter.

## Recommended Remediation
- Primary: Configure Envoy/Istio circuit breaker with consecutive 5xx ejection and connection pool limits.
- Secondary: Inject exponential backoff with full jitter into client service configuration.
- Tertiary: Enforce token-bucket rate limiting at the ingress proxy.
