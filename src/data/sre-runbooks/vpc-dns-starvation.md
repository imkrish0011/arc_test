# VPC Route53 DNS Resolution Starvation (1024 UDP pkt/s ENI Cap)

## Metadata
- **Scenario**: vpc_dns_starvation
- **Target Service**: AWS VPC Route53 Resolver & Kubernetes / ECS Networking
- **Fix Intent**: DEPLOY_NODE_LOCAL_DNS_CACHE

## Error Signatures & Patterns
- `Error: getaddrinfo EAI_AGAIN`
- `link-local 169.254.169.253 / 10.0.0.2 UDP packet rate exceeded 1024 pkts/sec limit`
- `LinkLocalPacketDrops`
- `NodeLocal DNSCache DaemonSet required`
- `kube-dns: upstream nameserver 10.0.0.2:53 timeout`
- `getaddrinfo EAI_AGAIN`
- `1024 pkts/sec limit`

## Common Root Causes
1. AWS VPC hard limits each Elastic Network Interface (ENI) to 1,024 UDP packets/second to the `.2` AmazonProvidedDNS resolver.
2. High-density container workloads making unpooled HTTP requests with `keepAlive: false` and default `ndots: 5`.
3. Scaling up pod replicas or container RAM fails to alleviate the ENI packet ceiling because all pods on that node share the same ENI cap.
4. Absence of a local node-level caching layer to absorb repetitive upstream DNS queries.

## Diagnostic Verification Steps
1. Correlate CloudWatch `LinkLocalPacketDrops` on the ENI with application `getaddrinfo EAI_AGAIN` errors.
2. Confirm latency spike in `DnsResolutionLatencyMs` to > 5,000ms timeout threshold.
3. Verify upstream DNS requests per second per node exceed 1,024 UDP pkt/s.

## Recommended Remediation
- Primary: Deploy NodeLocal DNSCache DaemonSet listening on link-local IP (`169.254.20.10`) with upstream TCP fallback.
- Secondary: Patch application HTTP agents with persistent connection pooling (`keepAlive: true`, `maxSockets: 500`).
- Tertiary: Reduce `ndots` search list to 2 in Kubernetes CoreDNS / resolv.conf.
