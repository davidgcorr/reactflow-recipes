import { type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Side } from '@/model';

export function IconButton({ label, children, className, ...props }: ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={label} title={label} className={cn('icon-control', className)} {...props}>{children}</Button></TooltipTrigger><TooltipContent side="bottom" sideOffset={8}>{label}</TooltipContent></Tooltip>;
}
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cn('field', className)}><Label className="field-label">{label}</Label>{children}</div>;
}
export function SideSelect({ value, onChange, label = 'Port side' }: { value: Side; onChange: (v: Side) => void; label?: string }) {
  return <Select value={value} onValueChange={v => onChange(v as Side)}><SelectTrigger size="sm" className="w-full" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{(['left', 'right', 'top', 'bottom'] as Side[]).map(side => <SelectItem key={side} value={side}>{side.charAt(0).toUpperCase() + side.slice(1)}</SelectItem>)}</SelectContent></Select>;
}
