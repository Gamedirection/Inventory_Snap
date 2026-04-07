import { Badge } from '@/components/ui/Badge'

interface ConfidenceBadgeProps {
  score: number
  showValue?: boolean
}

export function ConfidenceBadge({ score, showValue = true }: ConfidenceBadgeProps) {
  const variant =
    score >= 0.8 ? 'sage' :
    score >= 0.5 ? 'kraft' :
                   'rust'

  const label =
    score >= 0.8 ? 'High' :
    score >= 0.5 ? 'Medium' :
                   'Low'

  return (
    <Badge variant={variant} dot>
      {label}{showValue && ` · ${Math.round(score * 100)}%`}
    </Badge>
  )
}
