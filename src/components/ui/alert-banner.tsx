import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "border-primary/30 bg-primary-light text-foreground [&>svg]:text-primary",
        success: "border-success/30 bg-success-light text-foreground [&>svg]:text-success",
        warning: "border-warning/30 bg-warning-light text-foreground [&>svg]:text-warning",
        danger: "border-danger/30 bg-danger-light text-foreground [&>svg]:text-danger",
        destructive: "border-danger/30 bg-danger-light text-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  onClose?: () => void
  closable?: boolean
}

const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  ({ className, variant, children, onClose, closable = false, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), closable && "pr-12", className)}
      {...props}
    >
      {children}
      {closable && onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 hover:bg-foreground/10 transition-colors"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
)
AlertBanner.displayName = "AlertBanner"

const AlertBannerTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-sm font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertBannerTitle.displayName = "AlertBannerTitle"

const AlertBannerDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertBannerDescription.displayName = "AlertBannerDescription"

export { AlertBanner, AlertBannerTitle, AlertBannerDescription }
