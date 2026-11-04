# FinOps Idle Infrastructure & Unattached Resource Waste

## Metadata
- **Scenario**: finops_idle_waste
- **Target Service**: AWS EC2 EBS, VPC NAT Gateway
- **Fix Intent**: SNAPSHOT_AND_DELETE_EBS | REMOVE_IDLE_NAT_GATEWAY

## Error Signatures & Patterns
- `VolumeTotalReadWriteOps = 0`
- `BytesOutToDestination = 0`
- `AWS Cost Anomaly Detection`
- `AWS Trusted Advisor Notification: Idle NAT Gateway`
- `Unattached for 168 consecutive hours`
- `Resource state remains "available"`

## Common Root Causes
1. EBS volumes retained after EC2 instance termination (`DeleteOnTermination = false`).
2. Legacy or decommissioned VPC retaining an active NAT Gateway charging hourly base rates.
3. Leftover staging/dev resources orphaned after pipeline test runs.

## Diagnostic Verification Steps
1. Correlate with CloudTrail `DetachVolume` or `DeleteVpc` where dependent resources were not cleaned up.
2. Confirm 0 IOPS or 0 bytes processed continuously over a 7-day trailing window.
3. Verify resource attachment state is `available` (unattached).

## Recommended Remediation
- Primary: Create final snapshot of orphaned EBS volume and delete it.
- Delete unused NAT Gateways and release associated Elastic IPs.

