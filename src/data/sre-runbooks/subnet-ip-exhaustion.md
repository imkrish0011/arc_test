# VPC Subnet IP Address Exhaustion (InsufficientFreeAddressesInSubnet)

## Metadata
- **Scenario**: subnet_ip_exhaustion
- **Target Service**: AWS VPC, Subnets & Auto Scaling Groups
- **Fix Intent**: EXPAND_VPC_SECONDARY_CIDR

## Error Signatures & Patterns
- `InsufficientFreeAddressesInSubnet`
- `The subnet subnet-0987654321fedcba0 has 0 available IP addresses`
- `Client.InsufficientFreeAddressesInSubnet`
- `AvailableIpAddressCount`
- `failed to allocate ENI IP: no free private IP addresses available in subnet`
- `Associate secondary VPC CIDR block (100.64.0.0/16)`
- `SuccessfulInstances`

## Common Root Causes
1. VPC private application subnet `/24` has exhausted all 251 usable IP addresses due to container/pod scale and leaked ENIs.
2. Auto Scaling Group or EKS node launch fails immediately with AWS API error `Client.InsufficientFreeAddressesInSubnet`.
3. Scaling ASG instance count fails because zero private IP addresses can be bound to new elastic network interfaces.
4. Dangling unattached ENIs from test runners or failed automation jobs holding IP allocations.

## Diagnostic Verification Steps
1. Correlate CloudWatch `AvailableIpAddressCount = 0` on the subnet with `ASG-EC2-LaunchFailure-Spike`.
2. Inspect AWS EC2 API events for `InsufficientFreeAddressesInSubnet` response codes.
3. Check subnet IP utilization metrics in VPC console.

## Recommended Remediation
- Primary: Associate secondary IPv4 CIDR block (`100.64.0.0/16` RFC 6598) to the VPC via `aws_vpc_ipv4_cidr_block_association`.
- Secondary: Provision secondary high-capacity container subnets (`100.64.10.0/20` = 4,091 IPs) and attach them to ASG/EKS.
- Tertiary: Execute automated cleanup to release unattached, leaked ENIs.
