# Security Group Ingress Rule Drift & Unauthorized Exposure

## Metadata
- **Scenario**: security_group_drift
- **Target Service**: AWS EC2 / VPC Security Groups
- **Fix Intent**: REVOKE_PUBLIC_INGRESS_RULE

## Error Signatures & Patterns
- `AuthorizeSecurityGroupIngress` with CIDR `0.0.0.0/0`
- `AWSConfig-Rule-Restricted-Common-Ports-Drift`
- `GuardDuty-Recon-EC2-Portscan`
- `VPC Flow Logs: ACCEPT TCP` on sensitive ports (22, 5432, 3306, 6379, 27017)
- `brute-force dictionary attempt detected`
- `password authentication failed for user`

## Common Root Causes
1. Out-of-band manual change or emergency debug rule opened to `0.0.0.0/0`.
2. Infrastructure as Code drift bypassing approval gates.
3. Overly permissive ingress rules created during testing and forgotten.

## Diagnostic Verification Steps
1. Correlate with CloudTrail `AuthorizeSecurityGroupIngress` within the last 60 minutes.
2. Verify AWS Config compliance status (`NON_COMPLIANT`).
3. Check GuardDuty portscan / unauthorized access findings.
4. Pinpoint exact Security Group ID and exposed port numbers.

## Recommended Remediation
- Primary: Immediately revoke public ingress rule for sensitive ports (`0.0.0.0/0`).
- Restrict ingress strictly to authorized VPC CIDR blocks or bastion host security groups.

