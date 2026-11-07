# SQS Poison Pill Message Consumer CrashLoop

## Metadata
- **Scenario**: sqs_poison_pill_crashloop
- **Target Service**: AWS SQS & ECS / EKS Consumer Fleets
- **Fix Intent**: ATTACH_SQS_DEAD_LETTER_QUEUE

## Error Signatures & Patterns
- `Uncaught Exception: TypeError: Cannot read property amount_cents of undefined`
- `Task exited with code 1`
- `received 46 times without acknowledgment. Visibility timeout expired`
- `ApproximateAgeOfOldestMessage`
- `TaskStopCount`
- `Dead-letter queue required`
- `poison pill payload`

## Common Root Causes
1. Malformed or corrupted message published to SQS that unhandled parsing exceptions crash consumer processes immediately (Exit Code 1).
2. Absence of a Dead Letter Queue (DLQ) with redrive policy (`maxReceiveCount`), causing infinite redelivery loops.
3. ECS/Kubernetes restarts tasks repeatedly, while SQS visibility timeout expiration continuously feeds the toxic message back.
4. Naively scaling worker task replicas just causes more workers to crash simultaneously.

## Diagnostic Verification Steps
1. Correlate CloudWatch `ApproximateAgeOfOldestMessage` (> 300s) on SQS with ECS `TaskStopCount` (> 3) and Exit Code 1.
2. Confirm repeated redelivery of identical MessageId in consumer application logs.
3. Inspect SQS queue attributes confirming `RedrivePolicy` is absent or improperly configured.

## Recommended Remediation
- Primary: Provision an SQS Dead Letter Queue (DLQ) and attach it with a redrive policy (`maxReceiveCount = 3`).
- Secondary: Configure CloudWatch alarm on DLQ `ApproximateNumberOfMessagesVisible` to notify SREs of toxic payloads.
- Tertiary: Update consumer schema validator to catch malformed JSON safely without process panics.
