"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DatePickerProps = {
  /** ISO `YYYY-MM-DD` string. Empty string when none selected. */
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Forward to the trigger button. */
  className?: string
  /** Show a small clear (×) button when there's a value. */
  clearable?: boolean
  /** Pass through to react-day-picker (e.g. `(d) => d > new Date()`). */
  disabledDays?: React.ComponentProps<typeof Calendar>["disabled"]
}

function isoToDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso + (iso.length === 10 ? "T12:00:00" : ""))
  return isValid(d) ? d : undefined
}

function dateToIso(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecciona una fecha",
  disabled = false,
  className,
  clearable = true,
  disabledDays,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = isoToDate(value)
  const label = date ? format(date, "d MMM yyyy", { locale: es }) : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{label || placeholder}</span>
          {clearable && date && !disabled && (
            <span
              role="button"
              aria-label="Quitar fecha"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange("")
              }}
              className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(dateToIso(d))
              setOpen(false)
            }
          }}
          disabled={disabledDays}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
