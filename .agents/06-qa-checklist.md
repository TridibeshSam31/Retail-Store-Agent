# QA Checklist

Before calling the UI complete, verify:

## Product behavior
- [ ] Org isolation is respected.
- [ ] All activity is visible org-wide.
- [ ] Action prompts only appear for directly affected stores.
- [ ] No auto/confirm toggle exists.
- [ ] Immediate-low and might-be-low are visually distinct.
- [ ] Failed/aborted/rejected negotiations remain visible.
- [ ] Even-split fallback is explained correctly.
- [ ] No supplier is handled as an expected state, not an error.
- [ ] Supplier Send opens a deep link rather than pretending to send.
- [ ] Rejection supports renegotiate/contact supplier.
- [ ] Infra failure supports renegotiate/contact supplier/cancel.
- [ ] Simultaneous negotiations remain separate.
- [ ] Inventory never updates before N-of-N confirmation.

## UI states
- [ ] loading
- [ ] empty
- [ ] partial data
- [ ] API error
- [ ] retry
- [ ] pending action
- [ ] success
- [ ] rejected
- [ ] aborted
- [ ] completed
- [ ] supplier missing
- [ ] negotiation timeout/skip
- [ ] infrastructure failure

## Visual
- [ ] Dayos-inspired enterprise AI SaaS language.
- [ ] No copied logos/trademarks.
- [ ] Consistent spacing.
- [ ] Consistent status treatment.
- [ ] Responsive.
- [ ] Keyboard accessible.
- [ ] No unnecessary gradients/visual noise.
